import { defineStore } from 'pinia'
import { sep } from '@tauri-apps/api/path';

export const useAppStore = defineStore('app', {
  state:():{
    title:string,
    filepath:string|null,
    isSave:boolean,
  }=>({
    title:'marknote',
    filepath: null,
    isSave:false,
  }),
  actions:{
    setFilepath(filepath:string|null){
      this.filepath=filepath;
      if(filepath){
        var paths=filepath.split(sep);
        this.title=paths[paths.length-1];
        this.isSave=true;
      }
    }
  }
})