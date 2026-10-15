// @ts-nocheck
import { defineStore } from 'pinia'
import { useEditorStore } from './editor';
import { useAppStore } from './app';

import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask, message, open } from '@tauri-apps/plugin-dialog';
import * as appLog from '@tauri-apps/plugin-log';
import { exit } from '@tauri-apps/plugin-process';
import i18n from '../i18n';
import { openAbout, openPreferences, openWindow } from '../api/window';
import {
  check as checkUpdate,
} from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { PlatformType, openExplorer } from '../api/utils';

import { useImageExportStore } from './imageExport';
import { useDocumentExportStore } from './documentExport';
import { pasteFromClipboard } from '../utils/clipboard';
import { SHORTCUT_DEFINITIONS } from '../utils/shortcutPreferences';
import { installUpdateSafely } from '../utils/documentLifecycle';
import { useDocumentSearchStore } from './documentSearch';

const appWindow=getCurrentWindow();
// @ts-ignore
const { t } = i18n.global;
let checkingUpdate=false;

export interface Menu {
  label: string,
  type?: 'text' | 'checkbox'
  split?: boolean,
  key: string,
  shortcut?: string,
  checked?: boolean,
  disabled?: boolean,
  disabledReason?: string,
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
      if (useAppStore().lifecycleBusy) return;
      if(item.disabled)return;
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
  async newWindow() {
    const app=useAppStore();
    if(app.lifecycleBusy)return;
    app.resourceTasks++;
    try { await openWindow(); }
    finally { app.resourceTasks=Math.max(0,app.resourceTasks-1); }
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
    if(appStore.lifecycleBusy||appStore.resourceTasks||appStore.exporting)return;
    let selected=null;
    appStore.resourceTasks++;
    try{
      selected=await open({title:t('openFile'),multiple:false,filters:[{name:'Markdown',extensions:['md','markdown']}]});
    }catch(e){
      appStore.openFailedPath=null;
      appStore.openError=String(e||t('fileOpenFailed'));
      void appLog.error(`open file picker failed: ${String(e)}`);
    }finally{
      appStore.resourceTasks=Math.max(0,appStore.resourceTasks-1);
    }
    if(typeof selected==='string'&&selected)await appStore.openMarkdownDocument(selected);
  },
  async openFolder(){
    const appStore=useAppStore();
    if(appStore.lifecycleBusy||appStore.resourceTasks||appStore.exporting)return;
    appStore.resourceTasks++;
    try{
      const selected = await open({
        title:t('openFolder'),directory:true,multiple:false,
      });
      if(typeof selected==='string'&&selected){
        appStore.folder=selected;
        appStore.sidebar.active='folder';
        appStore.sidebar.visible=true;
      }
    }catch(error){
      void appLog.error(`open folder failed: ${String(error)}`);
      try{await message(t('folderPickerFailed'),{title:'MarkNote',kind:'error'});}catch{}
    }finally{
      appStore.resourceTasks=Math.max(0,appStore.resourceTasks-1);
    }
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
    return useDocumentExportStore().exportDocument('html');
  },
  exportPdf(){
    return useDocumentExportStore().exportDocument('pdf');
  },
  exportWord(){
    return useDocumentExportStore().exportDocument('word');
  },
  image(){
    useImageExportStore().open();
  },

  preferences() {
    openPreferences();
  },
  alwaysOnTop(item:Menu){
    appWindow.setAlwaysOnTop(item.checked===true);
  },

  undo(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return editorStore.runSourceCommand('undo');
    editorStore.editor?.commands.focus();
    editorStore.editor?.commands.undo();
  },
  redo(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return editorStore.runSourceCommand('redo');
    editorStore.editor?.commands.focus();
    editorStore.editor?.commands.redo();
  },
  copy(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return editorStore.runSourceCommand('copy');
    editorStore.editor?.commands.focus();
    document.execCommand('copy');
  },
  cut(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return editorStore.runSourceCommand('cut');
    editorStore.editor?.commands.focus();
    document.execCommand('cut');
  },
  async paste(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return editorStore.runSourceCommand('paste');
    return pasteFromClipboard(editorStore.editor);
  },
  selectAll(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return editorStore.runSourceCommand('selectAll');
    editorStore.editor?.commands.focus();
    editorStore.editor?.commands.selectAll();
  },

  find(){
    const editorStore=useEditorStore();
    if(editorStore.sourceMode!=='wysiwyg')return events.searchAll();
    editorStore.findVisbile=true;
  },
  searchAll(){
    const app=useAppStore();
    app.sidebar.visible=true;
    app.sidebar.active='search';
    useDocumentSearchStore().open('document');
  },
  searchWorkspace(){
    const app=useAppStore();
    app.sidebar.visible=true;
    app.sidebar.active='search';
    useDocumentSearchStore().open('workspace');
  },
  sourceMode(){
    const editor=useEditorStore();
    return editor.setSourceMode(editor.sourceMode==='source'?'wysiwyg':'source');
  },
  splitPreview(){
    const editor=useEditorStore();
    return editor.setSourceMode(editor.sourceMode==='split'?'wysiwyg':'split');
  },
  
  sidebar(item:Menu){
    const appStore=useAppStore();
    appStore.sidebar.visible=item.checked||false;
    // appStore.visible.folder=item.checked||false;
  },

  async quit() {
    const appStore=useAppStore();
    try{await appStore.runApplicationAction(()=>exit());}catch(error){
      void appLog.error(`application quit failed: ${String(error)}`);
    }
  },

  about(){
    openAbout();
  },

  async checkUpdate(){
    const appStore=useAppStore();
    if(checkingUpdate)return;
    if(appStore.lifecycleBusy||appStore.exporting||appStore.resourceTasks>0){
      appStore.reportLifecycleFailure('busy');
      return;
    }
    checkingUpdate=true;
    let manifest;
    try{
      manifest=await checkUpdate({
        timeout:15000,
        headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},
      });
      if(!manifest){
        await message(t('updateUpToDate'),{title:t('checkUpdate')});
        return;
      }
      const yes=await ask(t('updateAvailableTip',{version:manifest.version,body:manifest.body||''}),{
        title:t('updateAvailableTitle'),okLabel:t('updateInstall'),cancelLabel:t('cancel'),
      });
      if(!yes)return;
      await installUpdateSafely(manifest,action=>appStore.runApplicationAction(action),async()=>{
        // Windows install exits after starting the native updater installer.
        if(appStore.platform!=='windows')await relaunch();
      });
    }catch(error){
      void appLog.error(`update failed: ${String(error)}`);
      try{await message(t('updateFailed'),{title:'MarkNote',kind:'error'});}catch(dialogError){
        void appLog.error(`update feedback failed: ${String(dialogError)}`);
      }
    }finally{
      if(manifest)try{await manifest.close();}catch(error){void appLog.warn(`update resource cleanup failed: ${String(error)}`);}
      checkingUpdate=false;
    }
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

  async quickStart(){
    const path='./docs/marknote.md';
    await useAppStore().openMarkdownDocument(path);
  },

  '*':async (item:Menu)=>{
    const definition=SHORTCUT_DEFINITIONS.find(definition=>definition.description[1]===item.key);
    if(definition && ['format','paragraph'].includes(definition.description[0])){
      const editorStore=useEditorStore();
      if(editorStore.editor){
        editorStore.editor.commands.focus();
        useAppStore().keyBinding?.executeEditorAction(editorStore.editor,definition.id);
      }
    }else if(item.key.startsWith('recent_')){
      const key=item.key.substring(7);
      const appStore=useAppStore();
      await appStore.openMarkdownDocument(key);
      
    }
    console.log(item);
  }
}
