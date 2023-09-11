import { defineStore } from 'pinia'
import { sep } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/api/os';
import { emit, listen } from '@tauri-apps/api/event'
// import { message } from '@tauri-apps/api/dialog'
import { appWindow } from '@tauri-apps/api/window'
import { useI18n } from "vue-i18n";

export const useAppStore = defineStore('app', {
  state:():{
    title:string,
    filepath:string|null,
    isSave:boolean,
    platform:null|'linux'| 'darwin'| 'ios'| 'freebsd'| 'dragonfly'| 'netbsd'| 'openbsd'| 'solaris'| 'android'| 'win32',
    visible:{
      outliner:boolean,
    }
  }=>({
    title:'marknote',
    filepath: null,
    isSave:false,
    platform:null,
    visible:{
      outliner:false,
    }
  }),
  actions:{
    setFilepath(filepath:string|null){
      this.filepath=filepath;
      if(filepath){
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
      });
      listen<string>('language', async (event) => {
        const value=event.payload;
        locale.value=value;
        localStorage.setItem("lang", value);
        // const window=getCurrent();
        
        // await message(value, window.label+' language');
      })
    }
  }
})