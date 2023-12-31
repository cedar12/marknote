import { defineStore } from 'pinia'
import { emit, listen,TauriEvent } from '@tauri-apps/api/event'
import { getCurrent } from '@tauri-apps/api/window'
import { useI18n } from "vue-i18n";
import {useEditorStore} from './editor';
import {usePreferencesStore} from './preferences';
import { KeyBindingBuilder } from '../utils/keyBinding';
import { isImage } from '../utils';
import { read, save, saveImagePath } from '../api/file';
import { saveAs} from '../api/dialog';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { confirm } from '@tauri-apps/plugin-dialog';
import i18n from '../i18n';
import { findThemeByType, setTheme, ThemeItem } from '../theme';
import { args, PlatformType } from '../api/utils';

const appWindow=getCurrent();
// @ts-ignore
const { t } = i18n.global;

const autoTheme=localStorage.getItem('autoTheme');

function getTheme(){
  var theme=null;
  try{
    const themeJson=localStorage.getItem('theme');
    if(themeJson){
      theme=JSON.parse(themeJson);
    }
  }catch(e){
    console.error(e);
  }
  if(!theme){
    theme=findThemeByType('light');
  }
  if(theme){
    setTheme(theme);
  }
  return theme;
}

export const useAppStore = defineStore('app', {
  state:():{
    title:string|null,
    filepath:string|null,
    isSave:boolean,
    recentFiles:string[],
    platform:PlatformType,
    visible:{
      outliner:boolean,
      folder:boolean,
    },
    sidebar:{
      visible:boolean,
      active: 'outliner'|'folder',
      width: number,
    }
    keyBinding:KeyBindingBuilder|null,
    menuKey:number,
    permissionGranted:boolean,
    theme:ThemeItem|undefined,
    autoTheme:boolean,
    folder:string|null,
    loading:boolean,
    exporting:boolean,
    autoSave:boolean,
  }=>({
    title:null,
    filepath: null,
    isSave:false,
    // @ts-ignore
    platform:window.os,
    recentFiles:JSON.parse(localStorage.getItem('recent')||'[]'),
    visible:{
      outliner:false,
      folder:false,
    },
    sidebar:{
      visible:false,
      active: 'outliner',
      // @ts-ignore
      width: localStorage.getItem('sidebarWidth')?parseInt(localStorage.getItem('sidebarWidth')):220,
    },
    keyBinding:new KeyBindingBuilder(),
    menuKey:0,
    permissionGranted:false,
    theme:getTheme(),
    autoTheme:false,
    folder:null,
    loading:true,
    exporting:false,
    autoSave:false,
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
        if(this.recentFiles.length>10){
          this.recentFiles=this.recentFiles.splice(10,this.recentFiles.length-10);
        }
        localStorage.setItem('recent',JSON.stringify(this.recentFiles));
        const sep=this.platform==='windows'?'\\':'/';

        var paths=filepath.split(sep);
        
        this.title=paths[paths.length-1];
        this.isSave=true;
        appWindow.setTitle(filepath);
      }else{
        this.title=null;
        this.isSave=true;
      }
    },

    emit(event:string,payload:any){
      emit(event,payload);
    },

    closeWindow(){
      appWindow.emit(TauriEvent.WINDOW_CLOSE_REQUESTED);
      
    },

    async init(){
      document.documentElement.style.setProperty('--sidebarWidth', this.sidebar.width + 'px');
      this.menuKey=this.menuKey+1;
      this.isSave=true;
      appWindow.show();
      
      if(autoTheme=='true'){
        this.autoTheme=true;
        const isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)");
        setTheme(findThemeByType(isDarkTheme.matches?'dark':'light') as any);
      }

      

      isPermissionGranted().then(async (permissionGranted)=>{
        this.permissionGranted=permissionGranted;
        if (!this.permissionGranted) {
          const permission = await requestPermission();
          this.permissionGranted = permission === 'granted';
        }
      });
      
      // this.loading=false;
      const { locale } = useI18n();
      // platform().then(async (p:any)=>{
        
      //   this.platform=p;
      //   this.keyBinding=new KeyBindingBuilder();
      //   this.menuKey=this.menuKey+1;

      //   this.permissionGranted = await isPermissionGranted();
      //   if (!this.permissionGranted) {
      //     const permission = await requestPermission();
      //     this.permissionGranted = permission === 'granted';
      //   }
        
      //   this.loading=false;
        
      // });

      const preferencesStore=usePreferencesStore();

      if(appWindow.label==='main'){
        const editorStore=useEditorStore();
        // this.args=window.filesOpen||[];
        // log.debug(window.filesOpen);
        
        args().then(async (payload:string[])=>{
          
          if(payload.length===1){
            let path=payload[0];
            if(path.startsWith('file://')){
              path=payload[0].substring(7);
            }
            
            editorStore.loading=true;
            const resp:any=await read(path);
            if (resp.code === 0) {
              const appStore = useAppStore();
              appStore.setFilepath(path);
              editorStore.setContent(resp.data);
            }
          }else if(payload.length>1){
            let path=payload[1];
            if(path.startsWith('file://')){
              path=payload[1].substring(7);
            }
            editorStore.loading=true;
            const resp:any=await read(path);
            if (resp.code === 0) {
              const appStore = useAppStore();
              appStore.setFilepath(path);
              editorStore.setContent(resp.data);
            }
            
          }
          editorStore.loading=false;
        }).catch(()=>{
          editorStore.loading=false;
        });
        
      }

      

      if(appWindow.label!=='preferences'&&appWindow.label!=='about'){

        appWindow.listen(TauriEvent.WINDOW_FOCUS,()=>{
          const editorStore=useEditorStore();
          editorStore.editor.commands.focus();
        });

        
        appWindow.listen(TauriEvent.WINDOW_CLOSE_REQUESTED,async (ev)=>{
          console.log(ev);
          // debugger;
          
          if(this.isSave){
            
            await appWindow.close();
          }else{
            try{
              // @ts-ignore
              const yes=await confirm(t('closeTip'), {title:t('closeTitleTip'),okLabel:t('giveUp'),cancelLabel:t('save')});
              if(yes===false){
                this.save();
              }else{
                await appWindow.close();
              }
            }catch(e){
              console.log(e);
            }
            
          }
        });
        
        appWindow.listen(TauriEvent.WINDOW_FILE_DROP,async (ev)=>{
          console.log('ev',ev);
          if(!this.filepath)return;
          const editorStore=useEditorStore();
          // @ts-ignore
          const {state,view}=editorStore.editor;
          const { schema } = state;

          const payload=ev.payload as any;
          for (let i = 0; i < payload.paths.length; i++) {
            const src = payload.paths[i];
            if(isImage(src)){
              console.log(state,view);
              try{
                const resp=await saveImagePath(this.filepath,src) as any;
                console.log(resp);
                if(resp.code===0){
                  const node = schema.nodes.image.create({
                    src: resp.info.replace(/\\/g,'/'),
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
      }

      

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
      listen<boolean>('autoSave', async (event) => {
        const value=event.payload;
        localStorage.setItem("autoSave", value.toString());
        this.autoSave=value;
        
      });


      listen<number>('tabSize', async (event) => {
        const value=event.payload;
        preferencesStore.editor.tabSize=value;
        document.documentElement.style.setProperty('--tabSize',''+value);
      });

      
      listen<ThemeItem>('theme', async (event) => {
        const value=event.payload;
        setTheme(value);
      });

      appWindow.listen(TauriEvent.WINDOW_THEME_CHANGED,(ev)=>{
        if(this.autoTheme){
          const themeType:any=ev.payload;
          const theme=findThemeByType(themeType);
          if(theme){
            emit('theme',theme);
          }
        }
      });

      emit('unsavedColor',localStorage.getItem('unsavedColor')||'rgb(66, 212, 21)');
      emit('autoSave',localStorage.getItem('autoSave')==='true');

    },

    save(){
      const editorStore = useEditorStore();
      const md=editorStore.editor?.storage.markdown.getMarkdown();
      if (this.filepath) {
        save(this.filepath, md).then((res:any) => { 
          console.log('save',res);
          if(res.code===0){
            this.isSave=true;
          }
        }).catch(e => console.error(e));
      }else{
        //@ts-ignore
        saveAs(md ,t('save')).then((res:any) => { 
          console.log('save',res);
          if(res.code===0){
            this.setFilepath(res.info);
          }
        }).catch(e => console.error(e));
      }
    }
  }
})
