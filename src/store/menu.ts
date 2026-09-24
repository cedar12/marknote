// @ts-nocheck
import { defineStore } from 'pinia'
import { useEditorStore } from './editor';
import { useAppStore } from './app';

import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask, message, open,save } from '@tauri-apps/plugin-dialog';
import * as appLog from '@tauri-apps/plugin-log';
import { exit } from '@tauri-apps/plugin-process';
import {openFile} from '../api/dialog';
import {exportHTML, exportImage,exportPDF, exportWord, read,readToHTML} from '../api/file';
import i18n from '../i18n';
import { openAbout, openPreferences, openWindow } from '../api/window';
import {
  check as checkUpdate,
} from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { PlatformType, openExplorer } from '../api/utils';
import {toImage,handleHtml} from '../utils';
import { nextTick } from 'vue';
import html2canvas from 'html2canvas';

const appWindow=getCurrentWindow();
// @ts-ignore
const { t } = i18n.global;

export interface Menu {
  label: string,
  type?: 'text' | 'checkbox'
  split?: boolean,
  key: string,
  shortcut?: string,
  checked?: boolean,
  platform?:PlatformType[],
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
    // appWindow.close();
    const appStore = useAppStore();
    appStore.closeWindow();
  },
  async newFile(){
    const appStore = useAppStore();
    await appStore.runAfterUnsavedCheck(async ()=>{
      appStore.setFilepath(null);
      const editorStore=useEditorStore();
      await editorStore.setContent('');
      editorStore.focus();
    });
  },
  async openFile() {
    const appStore=useAppStore();
    if(!await appStore.guardUnsavedChanges()){
      return;
    }
    const editorStore=useEditorStore();
    editorStore.loading=true;
    try{
      const resp:any=await openFile(t('openFile'));
      if (resp.code === 0) {
        appStore.setFilepath(resp.info);
        await editorStore.setContent(resp.data);
      }
    }catch(e){
      // Closing the native file picker is a normal cancellation path.
      if(String(e||'').trim()){
        appLog.error(`open file failed: ${String(e)}`);
      }
    }finally{
      editorStore.loading=false;
    }
  },
  openFolder(){
    async function dir() {
      const selected = await open({
        directory:true,
      });
      const appStore=useAppStore();
      if(!Array.isArray(selected)){
        appStore.folder=selected;
      }
      appStore.sidebar.active='folder';
      appStore.sidebar.visible=true;
      
    }
    dir();
  },
  closeFolder(){
    const appStore=useAppStore();
    appStore.folder=null;
    console.log('close folder');
  },
  clearRecent(){
    const appStore = useAppStore();
    appStore.recentFiles=[];
    localStorage.setItem('recent',JSON.stringify(appStore.recentFiles));
  },
  save() {
    // const editorStore = useEditorStore();
    const appStore = useAppStore();
    appStore.save();

  },
  async saveAs() {
    const appStore = useAppStore();
    await appStore.save(true);
  },
  openExplorer(){
    const appStore = useAppStore();
    if(appStore.filepath){
      openExplorer(appStore.filepath);
    }
    
  },

  html(){
    save({
      title:`${t('export')} ${t('html')}`,
      filters:[{name:t('html'),extensions:['html']}]
    }).then(async (path)=>{
      if(!path)return;
      const div=document.querySelector('div.marknote');
      if(!div)return;
      const editorStore=useEditorStore();
      const html=await handleHtml(div);//div?.innerHTML;
      // const html=editorStore.editor.getHTML();
      const appStore = useAppStore();
      if(appStore.filepath&&appStore.isSave){
        
        try{
          await exportHTML(path,html);
          sendNotification(`${t('export')} ${t('html')}`,path);
        }catch(e){
          appLog.error(e);
        }
      }
    });
    // console.log('html',html);
  },
  exportPdf(){
    save({
      title:`${t('export')} PDF`,
      filters:[{name:'PDF',extensions:['pdf']}]
    }).then(async (path)=>{
      if(!path)return;
      const div=document.querySelector('div.marknote');
      if(!div)return;
      const editorStore=useEditorStore();
      const html=await handleHtml(div);//div?.innerHTML;
      // const html=editorStore.editor.getHTML();
      const appStore = useAppStore();
      if(appStore.filepath&&appStore.isSave){
        
        try{
          await exportPDF(path,html);
          sendNotification(`${t('export')} PDF`,path);
        }catch(e){
          console.log(e);
          appLog.error(e.toString());
        }
      }
    });
  },
  async exportWord(){
    const title=`${t('export')} ${t('word')}`;
    try{
      const path=await save({
        title,
        filters:[{name:t('word'),extensions:['docx']}]
      });
      if(!path)return;

      const editorStore=useEditorStore();
      const markdown=editorStore.getMarkdown();
      if(typeof markdown!=='string'){
        throw new Error(t('documentNotReady'));
      }
      const appStore=useAppStore();
      const response:any=await exportWord(path,markdown,appStore.filepath);
      if(!response || response.code!==0){
        throw new Error(response?.info || t('exportFailed'));
      }
      sendNotification(title,path);
    }catch(error){
      const details=String(error||t('exportFailed'));
      appLog.error(`Word export failed: ${details}`);
      try{
        await message(details,t('exportFailed'));
      }catch(dialogError){
        appLog.error(`Word export error dialog failed: ${String(dialogError)}`);
      }
    }
  },
  image(){
    save({
      title:`${t('export')}${t('image')}`,
      filters:[{name:t('image'),extensions:['png']}]
    }).then(path=>{
      if(!path)return;
      const div=document.querySelector('.layout-scrollbar>.el-scrollbar__wrap');
      // const titleBarHeight=document.documentElement.style.getPropertyValue('--titleBarHeight');
      const appStore=useAppStore();
      appStore.exporting=true;
      const editorStore=useEditorStore();
      editorStore.editor.commands.blur();
      appWindow.setResizable(false);
      nextTick(() =>{
        toImage(div,window.innerHeight-30).then(async (canvas) => {
          appStore.exporting=false;
          appWindow.setResizable(true);
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          console.log((imgData));
          try{
            await exportImage(path,imgData);
            sendNotification(`${t('export')}${t('image')}`,path);
          }catch(e){
            appLog.error(e);
          }
          
        }).catch(e=>{
          appWindow.setResizable(true);
          appStore.exporting=false;
          console.error(e);
        });
      });
    })
  },

  preferences() {
    openPreferences();
  },
  alwaysOnTop(item:Menu){
    appWindow.setAlwaysOnTop(item.checked===true);
  },

  undo(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.focus();
    editorStore.editor?.commands.undo();
  },
  redo(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.focus();
    editorStore.editor?.commands.redo();
  },
  copy(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.focus();
    document.execCommand('copy');
  },
  cut(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.focus();
    document.execCommand('cut');
  },
  paste(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.focus();
    // triggerPaste();
    window.navigator.clipboard.read().then(async c=>{
      if(c.length==0)return;
      const res=await c[0].getType('text/html');
      // console.log(res);
      return res.text();
    }).then((res:any)=>{
      // console.log(res);
      if(res)
      editorStore.editor.commands.insertContent(res);
    }).catch(e=>{
      console.error(e);
    })
  },
  selectAll(){
    const editorStore=useEditorStore();
    editorStore.editor?.commands.focus();
    editorStore.editor?.commands.selectAll();
  },

  find(){
    console.log('find...');
    const editorStore=useEditorStore();
    editorStore.findVisbile=true;
  },
  
  sidebar(item:Menu){
    const appStore=useAppStore();
    appStore.sidebar.visible=item.checked||false;
    // appStore.visible.folder=item.checked||false;
  },

  async quit() {
    const appStore=useAppStore();
    if(await appStore.guardUnsavedChanges()){
      await exit();
    }
  },

  about(){
    openAbout();
  },

  checkUpdate(){
    const fn=()=>{
      return new Promise(async (resolve,reject)=>{
        // const unlisten = await onUpdaterEvent(({ error, status }) => {
        //   // This will log all updater events, including status updates and errors.
        //   console.log('Updater event', error, status)
        // })
        
        try {
          const manifest = await checkUpdate();
          if(manifest){
            console.log('Update', manifest);
            const yes=await ask(`MarkNote ${manifest?.version} 现在可用，是否现在安装？\n发布时间: ${manifest?.date}\n说明: ${manifest?.body||''}`,'marknote的新版本可用！');
            if(yes){
              console.log(
                `Installing update ${manifest?.version}, ${manifest?.date}, ${manifest?.body}`
              )
          
              // Install the update. This will also restart the app on Windows!
              // await installUpdate()
              await manifest.downloadAndInstall();
          
              // On macOS and Linux you will need to restart the app manually.
              // You could use this step to display another confirmation dialog.
              await relaunch()
            }
            
          }else{
            sendNotification({ title: '检查更新', body: '已经是最新版本!' });
          }
          
          /*
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
          }*/
        } catch (error) {
          // unlisten();
          reject(error);
        }
        // you need to call unlisten if your handler goes out of scope, for example if the component is unmounted.
        // unlisten()
        resolve();
      })
    }
    fn().then(()=>{
      // unlisten();
    }).catch(error=>{
      alert(error);
      console.error(error);
    })
    
    // appWindow.emit('tauri://update');
  },

  bold(){
    const editorStore=useEditorStore();
    editorStore.editor.commands.toggleBold();
  },
  italic(){
    const editorStore=useEditorStore();
    editorStore.editor.commands.toggleItalic();
  },
  strikethrough(){
    const editorStore=useEditorStore();
    editorStore.editor.commands.toggleStrike();
  },
  clearFormat(){
    const editorStore=useEditorStore();
    editorStore.editor.commands.unsetMark();
  },

  codeFences(){
    const editorStore=useEditorStore();
    editorStore.editor.commands.toggleCodeBlock();
  },

  quoteBlock(){
    const editorStore=useEditorStore();
    editorStore.editor.commands.toggleBlockquote();
  },
  // mathBlock(){
  //   const editorStore=useEditorStore();
  //   editorStore.editor.commands.toggleKatex();
  // },

  quickStart(){
    const path='./docs/marknote.md';
    const appStroe=useAppStore();
    if(!appStroe.isSave){
      confirm(t('closeTip'), {title:t('closeTitleTip'),cancelLabel:t('save'),okLabel:t('giveUp')}).then(yes=>{
        console.log('confirm',yes);
        if(yes===false){
          appStroe.save();
        }else{
          readMarkdownFile(path);
        }
      });
      
    }else{
      readMarkdownFile(path);
    }
  },

  '*':async (item:Menu)=>{
    if(/^heading([1-6])$/.test(item.key)){
      //@ts-ignore
      const level=/^heading([1-6])$/.exec(item.key)[1];
      const editorStore=useEditorStore();
      editorStore.editor.commands.toggleHeading({level:parseInt(level) as any});
    }else if(item.key.startsWith('recent_')){
      const key=item.key.substring(7);
      const appStore=useAppStore();
      if(await appStore.guardUnsavedChanges()){
        await readMarkdownFile(key);
      }
      
    }
    console.log(item);
  }
}


async function readMarkdownFile(path:string){
  const editorStore=useEditorStore();
  editorStore.loading=true;
  try{
    const resp:any=await read(path);
    if (resp.code === 0) {
      const appStore = useAppStore();
      appStore.setFilepath(path);
      await editorStore.setContent(resp.data);
    }else{
      appLog.error(resp.info);
    }
  }catch(e){
    if(String(e||'').trim()){
      appLog.error(`read file failed: ${String(e)}`);
    }
  }finally{
    editorStore.loading=false;
  }
}
