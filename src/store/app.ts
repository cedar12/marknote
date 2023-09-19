import { defineStore } from 'pinia'
import { sep } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/api/os';
import { emit, listen,TauriEvent } from '@tauri-apps/api/event'
import { appWindow } from '@tauri-apps/api/window'
import { useI18n } from "vue-i18n";
import {useEditorStore} from './editor';
import { KeyBindingBuilder } from '../utils/keyBinding';
import { isImage } from '../utils';
import { saveImagePath } from '../api/file';
import { isPermissionGranted, requestPermission } from '@tauri-apps/api/notification';

export const useAppStore = defineStore('app', {
  state:():{
    title:string|null,
    filepath:string|null,
    isSave:boolean,
    recentFiles:string[],
    platform:null|'linux'| 'darwin'| 'ios'| 'freebsd'| 'dragonfly'| 'netbsd'| 'openbsd'| 'solaris'| 'android'| 'win32',
    visible:{
      outliner:boolean,
    },
    keyBinding:KeyBindingBuilder|null,
    menuKey:number,
    permissionGranted:boolean,
  }=>({
    title:null,
    filepath: null,
    isSave:false,
    platform:null,
    recentFiles:JSON.parse(localStorage.getItem('recent')||'[]'),
    visible:{
      outliner:false,
    },
    keyBinding:null,
    menuKey:0,
    permissionGranted:false,
  }),
  actions:{
    setFilepath(filepath:string|null){
      this.filepath=filepath;
      if(filepath){
        const index=this.recentFiles.findIndex(r=>r===filepath);
        if(index>-1){
          this.recentFiles.splice(index,1);
        }
        this.recentFiles.splice(0,0, filepath);
        localStorage.setItem('recent',JSON.stringify(this.recentFiles));
        var paths=filepath.split(sep);
        this.title=paths[paths.length-1];
        this.isSave=true;
        appWindow.setTitle(filepath);
      }
    },

    emit(event:string,payload:any){
      emit(event,payload);
    },

    init(){
      appWindow.show();
      const { locale } = useI18n();
      platform().then(async platform=>{
        this.platform=platform;
        this.keyBinding=new KeyBindingBuilder();
        this.menuKey=this.menuKey+1;

        this.permissionGranted = await isPermissionGranted();
        if (!this.permissionGranted) {
          const permission = await requestPermission();
          this.permissionGranted = permission === 'granted';
        }
      });

      appWindow.listen(TauriEvent.WINDOW_FILE_DROP,async (ev)=>{
        // console.log('ev',ev);
        if(!this.filepath)return;
        const editorStore=useEditorStore();
        // @ts-ignore
        const {state,view}=editorStore.editor;
        const { schema } = state;

        const payload=ev.payload as any;
        for (let i = 0; i < payload.length; i++) {
          const src = payload[i];
          if(isImage(src)){
            console.log(state,view);
            try{
              const resp=await saveImagePath(this.filepath,src) as any;
              console.log(resp);
              if(resp.code===0){
                const node = schema.nodes.image.create({
                  src: resp.info,
                });
                console.log(node);
                const transaction = view.state.tr.insert(state.selection.anchor, node);
                view.dispatch(transaction);
              }
            }catch(e){
              console.error(e);
            }
            
          }
        }
        
      });

      listen<string>('language', async (event) => {
        const value=event.payload;
        locale.value=value;
        localStorage.setItem("lang", value);
      });
      listen<string>('codeTheme', async (event) => {
        const value=event.payload;
        const editorStore=useEditorStore();
        editorStore.codeTheme=value;
        localStorage.setItem("codeTheme", value);
      });
      listen<string>('unsavedColor', async (event) => {
        const value=event.payload;
        localStorage.setItem("unsavedColor", value);
        document.documentElement.style.setProperty('--notSavedColor',value);
        
      });

      emit('unsavedColor',localStorage.getItem('unsavedColor')||'rgb(66, 212, 21)');
    }
  }
})
