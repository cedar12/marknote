import { defineStore } from 'pinia'
import { emit, listen,TauriEvent } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {useEditorStore} from './editor';
import {usePreferencesStore} from './preferences';
import { EDITOR_FONT_PREFERENCES_KEY, readEditorFont } from '../utils/editorFont';
import { KeyBindingBuilder } from '../utils/keyBinding';
import { watch, type Ref } from 'vue';
import { SHORTCUT_PREFERENCES_KEY, SHORTCUT_PREFERENCES_EVENT, readShortcutPreferences } from '../utils/shortcutPreferences';
import { isImage } from '../utils';
import { read, save, saveImagePath, probeFileVersion } from '../api/file';
import { saveAs} from '../api/dialog';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { ask, message } from '@tauri-apps/plugin-dialog';
import i18n from '../i18n';
import themes, { applyThemeCatalog, findThemeByType, isBuiltInTheme, isThemeItem, refreshThemeCatalog, setTheme, type ThemeItem } from '../theme';
import type { ThemeEntry } from '../api/theme';
import { args, PlatformType } from '../api/utils';
import * as appLog from '@tauri-apps/plugin-log';
import { createNativeDocumentLifecycle, isDocumentWindow, type LifecycleDecision, type LifecycleFailure } from '../utils/documentLifecycle';
import { FILE_SAVED_EVENT, fileIdentity, filePathFromArgument, normalizeFileVersion, sameFileContents, type FileVersion, type FileConflict } from '../utils/fileVersion';
import { rememberWindowSize, restoreWindowSize } from '../api/window';
import { readSidebarVisible, writeSidebarVisible } from '../utils/sidebarPreferences';
import { normalizeSidebarWidth, SIDEBAR_WIDTH_KEY } from '../utils/folderNavigation';

const appWindow=getCurrentWindow();
// @ts-ignore
const { t } = i18n.global;

const autoTheme=localStorage.getItem('autoTheme');
const AUTO_SAVE_DELAY_MS=600;
let autoSaveTimer:ReturnType<typeof setTimeout>|null=null;
let activeSave:Promise<boolean>|null=null;
let closeGuardInProgress=false;
let closeRequestSequence=0;
let unsavedGuardInProgress=false;
let openRequestSequence=0;
let checkingFile=false;
let fileCheckTimer:ReturnType<typeof setInterval>|null=null;
let documentLifecycle:ReturnType<typeof createNativeDocumentLifecycle>|null=null;
let lifecycleSession:{
  id:string;
  revision:number;
  filepath:string|null;
  renderVersion:number;
  editor:ReturnType<typeof useEditorStore>['editor'];
  editable:boolean;
}|null=null;

function getTheme(): ThemeItem | undefined {
  let theme: ThemeItem | undefined;
  try {
    const cached: unknown = JSON.parse(localStorage.getItem('theme') || 'null');
    if (isThemeItem(cached)) {
      theme = isBuiltInTheme(cached.value) ? findThemeByType(cached.type) : cached;
    }
  } catch { /* Fall back to the built-in theme when the saved selection is invalid. */ }
  theme ||= findThemeByType('light');
  if (theme) setTheme(theme);
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
      active: 'outliner'|'folder'|'search',
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
    lifecycleBusy:boolean,
    resourceTasks:number,
    draftCleanupPending:boolean,
    autoSave:boolean,
    saving:boolean,
    saveError:string|null,
    editRevision:number,
    fileVersion:FileVersion|null,
    fileCanonicalPath:string|null,
    fileConflict:FileConflict|null,
    openError:string|null,
    openFailedPath:string|null,
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
      visible:readSidebarVisible(),
      active: 'outliner',
      width: (()=>{try{return normalizeSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_KEY));}catch{return normalizeSidebarWidth(null);}})(),
    },
    keyBinding:new KeyBindingBuilder(),
    menuKey:0,
    permissionGranted:false,
    theme:getTheme(),
    autoTheme:false,
    folder:null,
    loading:true,
    exporting:false,
    lifecycleBusy:false,
    resourceTasks:0,
    draftCleanupPending:false,
    autoSave:false,
    saving:false,
    saveError:null,
    editRevision:0,
    fileVersion:null,
    fileCanonicalPath:null,
    fileConflict:null,
    openError:null,
    openFailedPath:null,
  }),
  actions:{
    syncThemeWithCatalog() {
      const current = this.theme;
      const selected = themes.find(theme => theme.value === current?.value)
        || findThemeByType(current?.type || 'light');
      if (selected) {
        this.theme = selected;
        setTheme(selected);
      }
    },
    rememberRecentFile(filepath:string){
      const index=this.recentFiles.findIndex(r=>r===filepath);
      if(index>-1)this.recentFiles.splice(index,1);
      this.recentFiles.splice(0,0,filepath);
      if(this.recentFiles.length>10)this.recentFiles=this.recentFiles.slice(0,10);
      localStorage.setItem('recent',JSON.stringify(this.recentFiles));
    },

    setFilepath(filepath:string|null,version:FileVersion|null=null,canonicalPath:string|null=null,rememberRecent=true){
      this.filepath=filepath;
      this.fileVersion=version;
      this.fileCanonicalPath=canonicalPath;
      this.fileConflict=null;
      this.openError=null;
      this.openFailedPath=null;
      if(filepath){
        if(rememberRecent)this.rememberRecentFile(filepath);
        const paths=filepath.split(/[\\/]/);
        
        this.title=paths[paths.length-1];
        this.isSave=true;
        this.saveError=null;
        appWindow.setTitle(filepath);
      }else{
        this.title=null;
        this.isSave=true;
        this.saveError=null;
        appWindow.setTitle('MarkNote');
      }
    },

    async openMarkdownDocument(path:string,options:{startup?:boolean;lifecycleRequestId?:string;discard?:boolean}={}):Promise<'opened'|'cancelled'|'failed'>{
      const editor=useEditorStore();
      const ownsLifecycle=options.lifecycleRequestId&&lifecycleSession?.id===options.lifecycleRequestId;
      const guardRevision=this.editRevision;
      if((this.lifecycleBusy&&!ownsLifecycle)||this.exporting||this.resourceTasks>0||editor.loading||editor.renderingDocument
        ||editor.segmentLoading||editor.sourceComposing||editor.navigatingToHeading||(!options.startup&&this.loading))return 'cancelled';
      if(options.startup){
        if(this.filepath||!this.isSave)return 'cancelled';
      }else if(!options.discard&&!await this.guardUnsavedChanges(options.lifecycleRequestId))return 'cancelled';
      if(!options.startup&&!options.discard&&guardRevision!==this.editRevision){
        if(!this.isSave)void this.restoreCurrentDraft();
        return 'cancelled';
      }
      // The guard may have awaited a dialog. Recheck every pending operation before replacing content.
      if((this.lifecycleBusy&&!ownsLifecycle)||this.resourceTasks>0||this.exporting||editor.loading||editor.renderingDocument
        ||editor.segmentLoading||editor.sourceComposing||editor.navigatingToHeading||(!options.startup&&this.loading))return 'cancelled';
      const request=++openRequestSequence;
      const instance=editor.editor;
      const editable=instance?.isEditable;
      const previousEditor={...editor.$state,segments:[...editor.segments],headings:[...editor.headings],
        segmentHeadings:editor.segmentHeadings.map(headings=>[...headings])};
      const previousView=instance?.state;
      const previousApp={filepath:this.filepath,title:this.title,isSave:this.isSave,saveError:this.saveError,
        fileVersion:this.fileVersion,fileCanonicalPath:this.fileCanonicalPath,fileConflict:this.fileConflict,draftCleanupPending:this.draftCleanupPending};
      this.openError=null;
      this.openFailedPath=null;
      this.cancelScheduledAutoSave();
      this.resourceTasks+=1;
      editor.loading=true;
      instance?.setEditable(false,false);
      let opened=false;
      try{
        const response=await read(path);
        if(request!==openRequestSequence)return 'cancelled';
        if(!response||response.code!==0||typeof response.data!=='string')throw new Error(response?.info||t('fileOpenFailed'));
        this.setFilepath(path,normalizeFileVersion(response.version),response.canonicalPath||null,false);
        await editor.setContent(response.data);
        if(request!==openRequestSequence)return 'cancelled';
        if(instance&&editor.renderingDocument)throw new Error(t('fileOpenFailed'));
        editor.focus();
        this.rememberRecentFile(path);
        opened=true;
        return 'opened';
      }catch(error){
        if(request===openRequestSequence){
          editor.$patch({...previousEditor,renderVersion:editor.renderVersion+1});
          if(instance&&previousView&&typeof instance.view.updateState==='function'){
            (instance as unknown as {reactiveState:Ref<typeof previousView>}).reactiveState.value=previousView;
            instance.view.updateState(previousView);
          }
          this.$patch(previousApp);
          void appWindow.setTitle(previousApp.filepath||'MarkNote');
          this.openError=String(error||t('fileOpenFailed'));
          this.openFailedPath=path;
          void appLog.error(`open document failed: ${this.openError}`);
        }
        return 'failed';
      }finally{
        editor.loading=false;
        if(instance&&editor.editor===instance&&typeof editable==='boolean')instance.setEditable(editable,false);
        this.resourceTasks=Math.max(0,this.resourceTasks-1);
        if(!opened&&!this.isSave){
          await this.restoreCurrentDraft();
          if(this.autoSave&&this.filepath)this.scheduleAutoSave();
        }
      }
    },

    lockFileConflictAction():string|null{
      const editor=useEditorStore();
      if(this.lifecycleBusy||this.saving||this.loading||this.exporting||this.resourceTasks>0||unsavedGuardInProgress
        ||editor.loading||editor.renderingDocument||editor.segmentLoading||editor.sourceComposing||editor.navigatingToHeading||!editor.editor)return null;
      const id=`file-conflict-${appWindow.label}-${Date.now()}-${++closeRequestSequence}`;
      lifecycleSession={id,revision:this.editRevision,filepath:this.filepath,renderVersion:editor.renderVersion,
        editor:editor.editor,editable:editor.editor.isEditable};
      this.lifecycleBusy=true;
      this.cancelScheduledAutoSave();
      editor.editor.setEditable(false,false);
      return id;
    },

    observeFileVersion(path:string,canonicalPath:string,version:FileVersion){
      if(!this.filepath||fileIdentity(canonicalPath,this.platform==='windows')
        !==fileIdentity(this.fileCanonicalPath||this.filepath,this.platform==='windows'))return;
      if(sameFileContents(this.fileVersion,version)){
        this.fileVersion=version;
        this.fileConflict=null;
        if(this.autoSave&&!this.isSave)this.scheduleAutoSave();
        return;
      }
      this.cancelScheduledAutoSave();
      this.fileConflict={path,canonicalPath,version,detectedAt:Date.now()};
    },

    async checkFileForChanges(full=false):Promise<boolean>{
      const editor=useEditorStore();
      if(typeof probeFileVersion!=='function'||checkingFile||!this.filepath||this.loading||this.saving||this.lifecycleBusy
        ||this.resourceTasks>0||editor.loading||editor.renderingDocument||editor.segmentLoading||editor.sourceComposing
        ||(!full&&document.visibilityState==='hidden'))return false;
      const path=this.filepath;
      const baseline=this.fileVersion;
      checkingFile=true;
      try{
        const response=await probeFileVersion(path,baseline,full);
        if(path!==this.filepath||baseline!==this.fileVersion||this.saving||this.lifecycleBusy)return false;
        const version=normalizeFileVersion(response?.version);
        if(response?.code===0&&version&&response.canonicalPath){
          this.observeFileVersion(path,response.canonicalPath,version);
          return true;
        }
        return false;
      }catch(error){void appLog.warn(`file version check failed: ${String(error)}`);return false;}
      finally{checkingFile=false;}
    },

    async reloadFileAfterConflict():Promise<boolean>{
      if(!this.fileConflict||this.lifecycleBusy||this.exporting||this.resourceTasks>0)return false;
      const id=this.lockFileConflictAction();
      if(!id)return false;
      const path=this.fileConflict.path;
      const revision=this.editRevision;
      try{
        const yes=await ask(t('fileConflictReloadConfirm',{path}),{title:t('fileConflictTitle'),okLabel:t('fileConflictReload'),cancelLabel:t('cancel')});
        if(!yes||revision!==this.editRevision||lifecycleSession?.id!==id)return false;
        // Explicit reload authorizes only the revision shown by this confirmation.
        if(!await this.clearCurrentDraft()||revision!==this.editRevision)return false;
        return await this.openMarkdownDocument(path,{lifecycleRequestId:id,discard:true})==='opened';
      }finally{
        this.releaseApplicationAction(id);
      }
    },

    async overwriteFileAfterConflict():Promise<boolean>{
      const conflict=this.fileConflict;
      if(!conflict||!conflict.version||this.lifecycleBusy||this.exporting||this.resourceTasks>0)return false;
      const id=this.lockFileConflictAction();
      if(!id)return false;
      try{
        const yes=await ask(t('fileConflictOverwriteConfirm',{path:conflict.path}),{title:t('fileConflictTitle'),kind:'warning',
          okLabel:t('fileConflictOverwrite'),cancelLabel:t('cancel')});
        if(!yes||this.fileConflict!==conflict||lifecycleSession?.id!==id)return false;
        const samePath=this.filepath&&fileIdentity(this.fileCanonicalPath||this.filepath,this.platform==='windows')
          ===fileIdentity(conflict.canonicalPath,this.platform==='windows');
        return this.save(!samePath,id,{expectedVersion:conflict.version});
      }finally{this.releaseApplicationAction(id);}
    },

    markEdited(){
      this.editRevision+=1;
      this.isSave=false;
      if(this.autoSave&&this.filepath){
        this.scheduleAutoSave();
      }
    },

    cancelScheduledAutoSave(){
      if(autoSaveTimer){
        clearTimeout(autoSaveTimer);
        autoSaveTimer=null;
      }
    },

    scheduleAutoSave(){
      this.cancelScheduledAutoSave();
      if(this.lifecycleBusy||this.fileConflict)return;
      autoSaveTimer=setTimeout(()=>{
        autoSaveTimer=null;
        void this.save(false,undefined,{automatic:true});
      },AUTO_SAVE_DELAY_MS);
    },

    async clearCurrentDraft():Promise<boolean>{
      try{
        const {useDraftsStore}=await import('./drafts');
        const cleared=await useDraftsStore().clearCurrent();
        this.draftCleanupPending=!cleared;
        return cleared;
      }catch(error){
        this.draftCleanupPending=true;
        void appLog.error(`draft cleanup failed: ${String(error)}`);
        return false;
      }
    },

    async restoreCurrentDraft(){
      try{
        const {useDraftsStore}=await import('./drafts');
        await useDraftsStore().capture(true);
      }catch(error){void appLog.error(`draft protection restore failed: ${String(error)}`);}
    },

    async guardUnsavedChanges(lifecycleRequestId?:string):Promise<boolean>{
      const editorStore=useEditorStore();
      const ownsLifecycle=()=>lifecycleRequestId
        ?this.lifecycleBusy&&lifecycleSession?.id===lifecycleRequestId
        :!this.lifecycleBusy;
      if(!ownsLifecycle()||this.exporting||this.resourceTasks>0||this.loading||editorStore.loading||editorStore.renderingDocument
        ||editorStore.segmentLoading||editorStore.sourceComposing||editorStore.navigatingToHeading||unsavedGuardInProgress){
        return false;
      }
      unsavedGuardInProgress=true;
      let allowed=false;
      this.cancelScheduledAutoSave();
      try{
        if(activeSave)await activeSave;
        if(!ownsLifecycle())return false;
        const revision=this.editRevision;
        const filepath=this.filepath;
        if(this.isSave){
          if(this.draftCleanupPending&&!await this.clearCurrentDraft())return false;
          return allowed=ownsLifecycle()&&this.isSave&&revision===this.editRevision&&filepath===this.filepath;
        }
        const decision=await message(t('closeTip'), {
          title:this.title?`${t('closeTitleTip')} (${this.title})`:t('closeTitleTip'),
          kind:'warning',
          buttons:{yes:t('save'),no:t('giveUp'),cancel:t('cancel')},
        });
        if(!ownsLifecycle()||revision!==this.editRevision||filepath!==this.filepath)return false;
        if(decision===t('giveUp')){
          if(!await this.clearCurrentDraft())return false;
          return allowed=ownsLifecycle()&&revision===this.editRevision&&filepath===this.filepath;
        }
        if(decision!==t('save'))return false;
        const saved=await this.save(false,lifecycleRequestId);
        return allowed=saved&&ownsLifecycle()&&this.isSave&&!this.draftCleanupPending;
      }catch(e){
        appLog.error(`unsaved-change guard failed: ${String(e)}`);
        return false;
      }finally{
        unsavedGuardInProgress=false;
        if(!allowed&&!this.lifecycleBusy&&!this.isSave){
          void this.restoreCurrentDraft();
          if(this.autoSave&&this.filepath)this.scheduleAutoSave();
        }
      }
    },

    reportLifecycleFailure(reason:LifecycleFailure){
      if(reason==='cancelled')return;
      const key=reason==='busy'?'lifecycleBusyTip':reason==='changed'?'lifecycleChangedTip'
        :reason==='timeout'?'lifecycleTimeoutTip':'lifecycleFailedTip';
      void message(t(key),{title:'MarkNote',kind:'warning'}).catch(error=>{
        void appLog.error(`lifecycle feedback failed: ${String(error)}`);
      });
    },

    async prepareApplicationAction(id:string,localClose=false):Promise<LifecycleDecision>{
      const editorStore=useEditorStore();
      if(this.lifecycleBusy||this.exporting||this.resourceTasks>0||this.loading||editorStore.loading||editorStore.renderingDocument
        ||editorStore.segmentLoading||editorStore.sourceComposing||editorStore.navigatingToHeading||(closeGuardInProgress&&!localClose)||unsavedGuardInProgress){
        return {allowed:false,reason:'busy'};
      }
      const editor=editorStore.editor;
      if(!editor)return {allowed:false,reason:'busy'};
      lifecycleSession={id,revision:this.editRevision,filepath:this.filepath,renderVersion:editorStore.renderVersion,
        editor,editable:editor.isEditable};
      this.lifecycleBusy=true;
      this.cancelScheduledAutoSave();
      editor.setEditable(false,false);
      if(activeSave)await activeSave;
      if(lifecycleSession?.id!==id)return {allowed:false,reason:'cancelled'};
      if(!await this.guardUnsavedChanges(id))return {allowed:false,reason:'cancelled'};
      if(lifecycleSession?.id!==id)return {allowed:false,reason:'cancelled'};
      lifecycleSession.revision=this.editRevision;
      lifecycleSession.filepath=this.filepath;
      lifecycleSession.renderVersion=editorStore.renderVersion;
      return {allowed:true};
    },

    validateApplicationAction(id:string):boolean{
      const editorStore=useEditorStore();
      return !!lifecycleSession&&lifecycleSession.id===id&&this.lifecycleBusy&&!this.exporting&&!this.saving
        &&this.resourceTasks===0&&!this.draftCleanupPending&&!editorStore.loading&&!editorStore.renderingDocument
        &&!editorStore.segmentLoading&&!editorStore.sourceComposing&&!editorStore.navigatingToHeading&&this.editRevision===lifecycleSession.revision
        &&this.filepath===lifecycleSession.filepath&&editorStore.renderVersion===lifecycleSession.renderVersion
        &&editorStore.editor===lifecycleSession.editor;
    },

    releaseApplicationAction(id:string,resume=true){
      if(lifecycleSession?.id!==id)return;
      const session=lifecycleSession;
      lifecycleSession=null;
      this.lifecycleBusy=false;
      if(useEditorStore().editor===session.editor)session.editor.setEditable(session.editable,false);
      if(resume&&!this.isSave){
        void this.restoreCurrentDraft();
        if(this.autoSave&&this.filepath)this.scheduleAutoSave();
      }
    },

    async initDocumentLifecycle(){
      if(!isDocumentWindow(appWindow.label))return;
      documentLifecycle||=createNativeDocumentLifecycle({
        prepare:id=>this.prepareApplicationAction(id),
        validate:id=>this.validateApplicationAction(id),
        release:(id,resume)=>this.releaseApplicationAction(id,resume),
      },reason=>this.reportLifecycleFailure(reason));
      await documentLifecycle.start();
    },

    async runApplicationAction(action:()=>Promise<void>):Promise<boolean>{
      await this.initDocumentLifecycle();
      return documentLifecycle?documentLifecycle.run(action,()=>this.rememberWindowSize()):false;
    },
    async rememberWindowSize():Promise<void>{
      try{await rememberWindowSize();}
      catch(error){void appLog.warn(`window size could not be saved: ${String(error)}`);}
    },

    async runAfterUnsavedCheck(action:()=>void|Promise<void>):Promise<boolean>{
      const revision=this.editRevision;
      if(!await this.guardUnsavedChanges()){
        return false;
      }
      const editor=useEditorStore();
      if(revision!==this.editRevision||this.lifecycleBusy||this.resourceTasks>0||this.exporting||this.loading
        ||editor.loading||editor.renderingDocument||editor.segmentLoading||editor.sourceComposing||editor.navigatingToHeading){
        if(!this.isSave)void this.restoreCurrentDraft();
        return false;
      }
      await action();
      return true;
    },

    emit(event:string,payload:any){
      emit(event,payload);
    },

    closeWindow(){
      return appWindow.close();
    },

    async init(){
      watch(()=>this.sidebar.visible,visible=>{
        if(!writeSidebarVisible(visible))void appLog.warn('sidebar visibility could not be saved');
      },{flush:'sync'});
      try{await this.initDocumentLifecycle();}catch(error){
        void appLog.error(`document lifecycle initialization failed: ${String(error)}`);
      }
      if(isDocumentWindow(appWindow.label)){
        try{await restoreWindowSize();}catch(error){void appLog.warn(`window size could not be restored: ${String(error)}`);}
      }
      document.documentElement.style.setProperty('--sidebarWidth', this.sidebar.width + 'px');
      this.menuKey=this.menuKey+1;
      this.isSave=true;
      appWindow.show();
      
      if(autoTheme=='true'){
        this.autoTheme=true;
        const isDarkTheme = window.matchMedia("(prefers-color-scheme: dark)");
        this.theme = findThemeByType(isDarkTheme.matches?'dark':'light');
        if (this.theme) setTheme(this.theme);
      }

      

      isPermissionGranted().then(async (permissionGranted)=>{
        this.permissionGranted=permissionGranted;
        if (!this.permissionGranted) {
          const permission = await requestPermission();
          this.permissionGranted = permission === 'granted';
        }
      });
      
      // this.loading=false;
      const { locale } = i18n.global;
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
      preferencesStore.applyEditorFont(readEditorFont());
      watch(() => preferencesStore.shortcuts, shortcuts => {
        this.keyBinding?.update(shortcuts);
      }, { deep: true, immediate: true, flush: 'sync' });
      void preferencesStore.loadShortcutPreferences().catch(error => {
        appLog.error(`Shortcut preferences loading failed: ${String(error)}`);
      });
      listen(SHORTCUT_PREFERENCES_EVENT, event => {
        preferencesStore.applyShortcutPreferences(event.payload);
      });
      listen('editorFontPreferences', event => {
        preferencesStore.applyEditorFont(event.payload);
      });
      // Browser storage events also update other open windows if native broadcasting fails.
      window.addEventListener('storage', event => {
        if (event.storageArea === localStorage && (event.key === SHORTCUT_PREFERENCES_KEY || event.key === null)) {
          preferencesStore.applyShortcutPreferences(readShortcutPreferences());
        }
        if (event.storageArea === localStorage && (event.key === EDITOR_FONT_PREFERENCES_KEY || event.key === null)) {
          preferencesStore.applyEditorFont(readEditorFont());
        }
      });
      void preferencesStore.loadMarkdownPreferences().catch(error => {
        appLog.error(`Markdown preferences loading failed: ${String(error)}`);
      });
      listen('markdownPreferences', event => {
        preferencesStore.applyMarkdownPreferences(event.payload);
      });

      if(appWindow.label==='main'){
        const editorStore=useEditorStore();
        // this.args=window.filesOpen||[];
        // log.debug(window.filesOpen);
        
        args().then(async (payload:string[])=>{
          if(payload.length)await this.openMarkdownDocument(filePathFromArgument(payload[0],this.platform==='windows'),{startup:true});
        }).catch(()=>{
          editorStore.loading=false;
        }).finally(()=>{
          this.loading=false;
        });
        
      }

      

      if(appWindow.label!=='preferences'&&appWindow.label!=='about'){

        appWindow.listen(TauriEvent.WINDOW_FOCUS,()=>{
          const editorStore=useEditorStore();
          editorStore.focus();
          void this.checkFileForChanges(true);
        });

        listen<{sourceWindow:string;canonicalPath:string;version:unknown}>(FILE_SAVED_EVENT,event=>{
          const payload=event.payload;
          if(!payload||payload.sourceWindow===appWindow.label||this.saving||this.lifecycleBusy)return;
          const version=normalizeFileVersion(payload.version);
          if(version&&typeof payload.canonicalPath==='string'&&this.filepath)this.observeFileVersion(this.filepath,payload.canonicalPath,version);
        });
        if(!fileCheckTimer){
          fileCheckTimer=setInterval(()=>{void this.checkFileForChanges();},2500);
          (fileCheckTimer as any)?.unref?.();
        }

        
        appWindow.onCloseRequested(async (event)=>{
          // The default close must never race the asynchronous guard. Keep the
          // document read-only until an explicit destroy has completed or failed.
          event.preventDefault();
          if(closeGuardInProgress||this.lifecycleBusy){
            if(!closeGuardInProgress)this.reportLifecycleFailure('busy');
            return;
          }
          closeGuardInProgress=true;
          const id=`close-${appWindow.label}-${Date.now()}-${++closeRequestSequence}`;
          let committed=false;
          try{
            const decision=await this.prepareApplicationAction(id,true);
            if(!decision.allowed){
              this.reportLifecycleFailure(decision.reason||'cancelled');
              return;
            }
            if(!this.validateApplicationAction(id)){
              this.reportLifecycleFailure('changed');
              return;
            }
            await this.rememberWindowSize();
            if(!this.validateApplicationAction(id)){
              this.reportLifecycleFailure('changed');
              return;
            }
            await appWindow.destroy();
            committed=true;
          }catch(e){
            appLog.error(`window close failed: ${String(e)}`);
            this.reportLifecycleFailure('unavailable');
          }finally{
            this.releaseApplicationAction(id,!committed);
            closeGuardInProgress=false;
          }
        });
        
        appWindow.onDragDropEvent(async (ev)=>{
          if(ev.payload.type!=='drop')return;
          if(this.lifecycleBusy||this.exporting||this.saving)return;
          const editorStore=useEditorStore();
          if(editorStore.loading||editorStore.renderingDocument||editorStore.segmentLoading||editorStore.sourceComposing||editorStore.navigatingToHeading)return;
          const editor=editorStore.editor;
          if(!editor?.isEditable)return;
          const paths=ev.payload.paths.filter(isImage);
          if(!paths.length)return;
          const filepath=this.filepath;
          const version=editorStore.renderVersion;
          let bookmark=editor.state.selection.getBookmark();
          const mapSelection=({transaction}:any)=>{bookmark=bookmark.map(transaction.mapping);};
          editor.on('transaction',mapSelection);
          this.resourceTasks+=1;
          try{
            for(const src of paths){
              const resp=await saveImagePath(filepath,src) as any;
              if(this.lifecycleBusy||this.filepath!==filepath||editorStore.editor!==editor||editorStore.renderVersion!==version)return;
              if(!resp||resp.code!==0||!resp.info)throw new Error(resp?.info||t('imageInsertFailed'));
              const node=editor.schema.nodes.image.create({src:resp.info.replace(/\\/g,'/')});
              const selection=bookmark.resolve(editor.state.doc);
              editor.view.dispatch(editor.state.tr.insert(selection.from,node));
            }
          }catch(error){
            void appLog.error(`image drop failed: ${String(error)}`);
            try{await message(t('imageInsertFailed'),{title:'MarkNote',kind:'error'});}catch(dialogError){
              void appLog.error(`image error feedback failed: ${String(dialogError)}`);
            }
          }finally{
            editor.off('transaction',mapSelection);
            this.resourceTasks=Math.max(0,this.resourceTasks-1);
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
        if(!value){
          this.cancelScheduledAutoSave();
        }else if(!this.isSave&&this.filepath){
          this.scheduleAutoSave();
        }
        
      });


      listen<number>('tabSize', async (event) => {
        const value=event.payload;
        preferencesStore.editor.tabSize=value;
        document.documentElement.style.setProperty('--tabSize',''+value);
      });

      listen<'buttons'|'scroll'>('segmentNavigationMode', (event) => {
        preferencesStore.setSegmentNavigationMode(event.payload);
      });

      
      listen<ThemeItem>('theme', event => {
        if (!isThemeItem(event.payload)) return;
        this.theme = event.payload;
        setTheme(event.payload);
      });
      listen<ThemeEntry[]>('themeCatalogChanged', event => {
        applyThemeCatalog(event.payload);
        this.syncThemeWithCatalog();
      });
      listen<boolean>('autoTheme', event => {
        if (typeof event.payload !== 'boolean') return;
        this.autoTheme = event.payload;
        localStorage.setItem('autoTheme', String(event.payload));
        if (this.autoTheme) {
          this.theme = findThemeByType(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
          if (this.theme) setTheme(this.theme);
        }
      });
      void refreshThemeCatalog().then(() => this.syncThemeWithCatalog()).catch(error => {
        appLog.error('Theme catalog loading failed: ' + String(error));
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
      if(appWindow.label!=='main')this.loading=false;

    },

    async save(forceSaveAs=false,lifecycleRequestId?:string,options:{automatic?:boolean;expectedVersion?:FileVersion|null}={}):Promise<boolean>{
      const editorStore = useEditorStore();
      const ownsLifecycle=()=>!this.lifecycleBusy||lifecycleSession?.id===lifecycleRequestId;
      const workBusy=()=>this.resourceTasks>0||this.exporting||this.loading||editorStore.loading||editorStore.renderingDocument
        ||editorStore.segmentLoading||editorStore.sourceComposing||editorStore.navigatingToHeading;
      const refuseBusy=()=>{
        if(options.automatic){
          if(this.autoSave&&this.filepath&&!this.isSave)this.scheduleAutoSave();
        }else this.reportLifecycleFailure('busy');
        return false;
      };
      if(!ownsLifecycle())return false;
      if(workBusy())return refuseBusy();
      this.cancelScheduledAutoSave();
      if(this.fileConflict&&!forceSaveAs&&options.expectedVersion===undefined){
        this.isSave=false;
        this.saveError=t('fileConflictDetected');
        await this.restoreCurrentDraft();
        return false;
      }

      while(activeSave){
        await activeSave;
        // A queued Save As must not enter its picker after a close/update acquired
        // this document, or after a resource operation started while it waited.
        if(!ownsLifecycle())return false;
        if(workBusy())return refuseBusy();
        if(this.fileConflict&&!forceSaveAs&&options.expectedVersion===undefined){
          this.isSave=false;
          this.saveError=t('fileConflictDetected');
          await this.restoreCurrentDraft();
          return false;
        }
        if(this.isSave&&!forceSaveAs&&options.expectedVersion===undefined){
          return true;
        }
      }

      const md=editorStore.getMarkdown();
      if(typeof md!=='string'){
        return false;
      }

      const revision=this.editRevision;
      const filepath=forceSaveAs?null:this.filepath;
      const sourceDocumentPath=this.filepath;
      const parser=editorStore.editor?.storage?.markdown?.parser?.md;
      const expected=options.expectedVersion===undefined?this.fileVersion:options.expectedVersion;
      this.saving=true;
      this.saveError=null;

      activeSave=(async ()=>{
        try{
          const res:any=filepath
            ? await save(filepath,md,expected)
            : await (async()=>{
              const {useDraftsStore}=await import('./drafts');
              return saveAs(md,t(forceSaveAs?'saveAs':'save'),sourceDocumentPath||useDraftsStore().resourceSourcePath||null,expected,parser);
            })();
          if(res?.code===409){
            this.isSave=false;
            this.saveError=t('fileConflictDetected');
            this.fileConflict={path:res.info||this.filepath||'',canonicalPath:res.canonicalPath||this.fileCanonicalPath||res.info||'',
              version:normalizeFileVersion(res.version),detectedAt:Date.now()};
            await this.restoreCurrentDraft();
            return false;
          }
          if(res.code!==0){
            throw new Error(res.info||t('saveFailed'));
          }

          if(!filepath){
            this.setFilepath(res.info,normalizeFileVersion(res.version),res.canonicalPath||null);
          }else{
            this.fileVersion=normalizeFileVersion(res.version);
            this.fileCanonicalPath=res.canonicalPath||this.fileCanonicalPath;
            this.fileConflict=null;
          }
          if(res.attachmentMapping)editorStore.setAttachmentMapping(res.attachmentMapping);

          this.isSave=revision===this.editRevision;
          // Disk success and recovery cleanup are separate: failed cleanup must not
          // misreport the completed write, but it must prevent a document transition.
          if(this.isSave){
            await this.clearCurrentDraft();
            if(!this.isSave)void this.restoreCurrentDraft();
          }
          return true;
        }catch(e){
          const error=String(e||'').trim();
          // An empty error is how the current Save As command reports a
          // cancelled native file picker; cancellation is not a failure.
          if(error&&error!=='Error'){
            this.saveError=error;
            appLog.error(`save failed: ${error}`);
            try{
              if(options.automatic)return false;
              await message(error,t('saveFailed'));
            }catch(dialogError){
              appLog.error(`save error dialog failed: ${String(dialogError)}`);
            }
          }
          return false;
        }
      })();

      try{
        return await activeSave;
      }finally{
        activeSave=null;
        this.saving=false;
      }
    }
  }
})
