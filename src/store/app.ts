import { defineStore } from 'pinia'
import { sep } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/api/os';
import { emit, listen } from '@tauri-apps/api/event'
// import { message } from '@tauri-apps/api/dialog'
import { appWindow } from '@tauri-apps/api/window'
import { useI18n } from "vue-i18n";
import {useEditorStore} from './editor2';
import { KeyBindingBuilder } from '../utils/keyBinding';

export const useAppStore = defineStore('app', {
  state:():{
    title:string,
    filepath:string|null,
    isSave:boolean,
    recentFiles:string[],
    platform:null|'linux'| 'darwin'| 'ios'| 'freebsd'| 'dragonfly'| 'netbsd'| 'openbsd'| 'solaris'| 'android'| 'win32',
    visible:{
      outliner:boolean,
    },
    keyBinding:KeyBindingBuilder|null,
    menuKey:number,
  }=>({
    title:'marknote',
    filepath: null,
    isSave:false,
    platform:null,
    recentFiles:JSON.parse(localStorage.getItem('recent')||'[]'),
    visible:{
      outliner:false,
    },
    keyBinding:null,
    menuKey:0,
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
      platform().then(platform=>{
        this.platform=platform;
        this.keyBinding=new KeyBindingBuilder();
        this.menuKey=this.menuKey+1;
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
    }
  }
})
