import { defineStore } from 'pinia'
import { useEditorStore } from './editor';
import { useAppStore } from './app';
import { appWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/api/process';
import {openFile,saveAs} from '../api/dialog';
import {read, save} from '../api/file';
import i18n from '../i18n';
import { openPreferences, openWindow } from '../api/window';

// @ts-ignore
const { t, } = i18n.global;

export interface Menu {
  label: string,
  type?: 'text' | 'checkbox'
  split?: boolean,
  key: string,
  shortcut?: string,
  checked?: boolean,
  children?: Menu[]
}


interface MenuState {
  visible: boolean,
  key: string | null,
}

export const useMenuStore = defineStore('menu', {
  state: (): MenuState => ({
    visible: false,
    key: null,
  }),
  actions: {
    setKey(item: Menu) {
      this.key = item.key;
      if (item.key) {
        const event = (events as any)[item.key];
        if (event) {
          event(item);
        }else if((events as any)['*']){
          (events as any)['*'](item);
        }
      }

    }
  }
})

const events = {
  newWindow() {
    openWindow();
  },
  closeWindow() {
    appWindow.close();
  },
  openFile() {
    const editorStore=useEditorStore();
    editorStore.loading=true;
    openFile(t('openFile')).then((resp:any)=>{
      if (resp.code === 0) {
        const appStore = useAppStore();
        appStore.setFilepath(resp.info);
        // editorStore.content = resp.data;
        editorStore.setContent(resp.data);
        editorStore.loading=false;
      } 
   }).catch(()=>{
    editorStore.loading=false;
   });
  },
  clearRecent(){
    const appStore = useAppStore();
    appStore.recentFiles=[];
    localStorage.setItem('recent',JSON.stringify(appStore.recentFiles));
  },
  save() {
    const editorStore = useEditorStore();
    const appStore = useAppStore();
    if (appStore.filepath) {
      save(appStore.filepath, editorStore.editor?.storage.markdown.getMarkdown()).then((res:any) => { 
        console.log('save',res);
        if(res.code===0){
          appStore.isSave=true;
        }
      }).catch(e => console.error(e));
    }else{
      saveAs( editorStore.editor?.storage.markdown.getMarkdown(),t('save')).then((res:any) => { 
        console.log('save',res);
        if(res.code===0){
          appStore.setFilepath(res.info);
        }
      }).catch(e => console.error(e));
    }

  },
  saveAs() {
    const editorStore = useEditorStore();
    const appStore = useAppStore();
    saveAs( editorStore.editor?.storage.markdown.getMarkdown(),t('saveAs')).then((res:any) => { 
      if(res.code===0){
        appStore.setFilepath(res.info);
      }
    }).catch(e => console.error(e));

  },
  preferences() {
    openPreferences();
  },
  alwaysOnTop(item:Menu){
    appWindow.setAlwaysOnTop(item.checked===true);
  },

  undo(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.undo();
  },
  redo(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.redo();
  },

  outliner(item:Menu){
    console.log(item)
    const appStore=useAppStore();
    appStore.visible.outliner=item.checked||false;
  },

  quit() {
    exit();
  },

  '*':(item:Menu)=>{
    if(item.key.startsWith('recent_')){
      const key=item.key.substring(7);
      const editorStore=useEditorStore();
      editorStore.loading=true;
      read(key).then((resp:any)=>{
        if (resp.code === 0) {
          const appStore = useAppStore();
          appStore.setFilepath(key);
          editorStore.setContent(resp.data);
          editorStore.loading=false;
        } 
      }).catch(()=>{
        editorStore.loading=false;
      });
    }
    console.log(item);
  }
}