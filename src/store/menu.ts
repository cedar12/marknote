import { defineStore } from 'pinia'
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import {useEditorStore} from './editor';
import {useAppStore} from './app';
import { getCurrent } from '@tauri-apps/api/window';


interface MenuState{
  visible:boolean,
  key:string|null,
}

export const useMenuStore = defineStore('menu', {
  state:():MenuState=>({
    visible:false,
    key:null,
  }),
  actions:{
    setKey(item:any){
      this.key=item.key;
      if(item.key){
        const event=(events as any)[item.key];
        if(event){
          event();
        }
      }
      
    }
  }
})

const events={
  newWindow(){
    invoke('open_window').then(()=>console.log('set shadow')).catch(e=>console.error(e));
  },
  closeWindow(){
    const window=getCurrent();
    window.close();
  },
  openFile(){
    open({
      multiple: false,
      filters: [{
        name: 'Markdown',
        extensions: ['md']
      }]
    }).then(async (selected)=>{
      if (Array.isArray(selected)) {
        // user selected multiple files
      } else if (selected === null) {
        // user cancelled the selection
      } else {
        // user selected a single file
        // console.log(selected);
        const resp:any=await invoke('read_md',{path:selected});
        if(resp.code===0){
          const appStore=useAppStore();
          appStore.setFilepath(selected);
          const editorStore=useEditorStore();
          editorStore.content=resp.data;
        }
        // console.log(resp);
      }
    }).catch(e=>console.error(e));
    
  },
  preferences(){
    invoke('open_preferences');
  }
}