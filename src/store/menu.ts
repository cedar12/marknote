import { defineStore } from 'pinia'
import { useEditorStore } from './editor';
import { useAppStore } from './app';
import { appWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/api/dialog';
import { exit } from '@tauri-apps/api/process';
import {openFile,saveAs} from '../api/dialog';
import {read, save} from '../api/file';
import i18n from '../i18n';
import { openAbout, openPreferences, openWindow } from '../api/window';
import {
  checkUpdate,
  installUpdate,
  onUpdaterEvent,
} from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';
import { sendNotification } from '@tauri-apps/api/notification';

// @ts-ignore
const { t } = i18n.global;

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
    const title=t('openFile');
    openFile(title).then((resp:any)=>{
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
    const md=editorStore.editor?.storage.markdown.getMarkdown();
    console.log(md);
    if (appStore.filepath) {
      save(appStore.filepath, md).then((res:any) => { 
        console.log('save',res);
        if(res.code===0){
          appStore.isSave=true;
        }
      }).catch(e => console.error(e));
    }else{
      saveAs(md ,t('save')).then((res:any) => { 
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

  about(){
    openAbout();
  },

  checkUpdate(){
    const fn=()=>{
      return new Promise(async (resolve,reject)=>{
        const unlisten = await onUpdaterEvent(({ error, status }) => {
          // This will log all updater events, including status updates and errors.
          console.log('Updater event', error, status)
        })
        
        try {
          const { shouldUpdate, manifest } = await checkUpdate()
        
          if (shouldUpdate) {
            
            // You could show a dialog asking the user if they want to install the update here.
            const yes=await ask(`marknote ${manifest?.version} 现在可用，是否现在安装？\n发布时间: ${manifest?.date}\n说明: ${manifest?.body}`,'marknote的新版本可用！');
            if(yes){
              console.log(
                `Installing update ${manifest?.version}, ${manifest?.date}, ${manifest?.body}`
              )
          
              // Install the update. This will also restart the app on Windows!
              await installUpdate()
          
              // On macOS and Linux you will need to restart the app manually.
              // You could use this step to display another confirmation dialog.
              await relaunch()
            }
          }else{
            sendNotification({ title: '检查更新', body: '已经是最新版本!' });
          }
        } catch (error) {
          unlisten();
          reject(error);
        }
        // you need to call unlisten if your handler goes out of scope, for example if the component is unmounted.
        // unlisten()
        resolve(unlisten);
      })
    }
    fn().then((unlisten:any)=>{
      unlisten();
    }).catch(error=>{
      alert(error);
      console.error(error);
    })
    
    // appWindow.emit('tauri://update');
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