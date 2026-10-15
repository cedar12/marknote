<template>
  <div class="marknote-layout">
    <!-- <div class="layout-outliner" v-if="appStore.visible.outliner">
      <Outliner></Outliner>
    </div>
    <div class="layout-folder" v-if="appStore.visible.folder">
      <Folder></Folder>
    </div> -->
    <Sidebar></Sidebar>
    <div class="layout-content" :class="`code-theme-${editor.activeCodeTheme} ${appStore.exporting?'exporting':''}`" >
      <ContextMenu :menu="menuItems">
        <ElScrollbar v-loading="appStore.exporting||editor.loading" class="layout-scrollbar" height="calc(100vh - var(--titleBarHeight))">
          <Editor></Editor>
        </ElScrollbar>
      </ContextMenu>
      <SearchAndReplace v-if="editor.sourceMode==='wysiwyg'"></SearchAndReplace>
      <div v-if="appStore.fileConflict" class="document-notice" role="alert">
        <span>{{ t('fileConflictDetected') }}</span>
        <div class="document-notice-actions">
          <button type="button" :disabled="documentActionBusy" @click="comparison.open()">{{ t('fileComparisonReview') }}</button>
          <button type="button" :disabled="documentActionBusy" @click="appStore.reloadFileAfterConflict()">{{ t('fileConflictReload') }}</button>
          <button type="button" :disabled="documentActionBusy" @click="appStore.save(true)">{{ t('saveAs') }}</button>
          <button type="button" :disabled="documentActionBusy" @click="appStore.overwriteFileAfterConflict()">{{ t('fileConflictOverwrite') }}</button>
        </div>
      </div>
      <div v-else-if="appStore.openError" class="document-notice" role="alert">
        <span>{{ t('fileOpenFailed') }}</span>
        <div class="document-notice-actions">
          <button v-if="appStore.openFailedPath" type="button" :disabled="documentActionBusy" @click="appStore.openMarkdownDocument(appStore.openFailedPath)">{{ t('retry') }}</button>
          <button type="button" @click="appStore.openError=null;appStore.openFailedPath=null">{{ t('dismiss') }}</button>
        </div>
      </div>
    </div>
    <Dialog></Dialog>
    <FileComparisonDialog />
  </div>
</template>
<script lang="ts" setup>
import { ref, computed } from 'vue';
import Editor from "./Editor.vue";
import ContextMenu from "./contextMenu/index.vue";
import { ContextMenuItem } from "./contextMenu/useContextMenu";
import { useI18n } from 'vue-i18n';
import { useEditorStore } from '../store/editor';
// import Outliner from './Toc.vue';
// import Folder from './Folder.vue';
import Sidebar from './sidebar/Sidebar.vue';
import {useAppStore} from '../store/app';
import {readText,writeText} from '@tauri-apps/plugin-clipboard-manager';
import {ElScrollbar} from 'element-plus';
import Dialog from './dialog/index.vue';
import SearchAndReplace from './SearchAndReplace.vue';
import { pasteFromClipboard } from '../utils/clipboard';
import FileComparisonDialog from './dialog/FileComparisonDialog.vue';
import { useFileComparisonStore } from '../store/fileComparison';
// import {triggerPaste} from '../api/utils';

const { t } = useI18n();
const appStore=useAppStore();

const editor = useEditorStore();
const comparison=useFileComparisonStore();
const documentActionBusy=computed(()=>appStore.lifecycleBusy||appStore.saving||appStore.exporting||appStore.resourceTasks>0
  ||editor.loading||editor.renderingDocument||editor.segmentLoading||editor.sourceComposing);


const menuItems = ref<ContextMenuItem[]>([
  
  {
    label: t('copy'),
    disabled() {
      if(editor.sourceMode!=='wysiwyg')return !editor.hasSourceSelection();
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    onClick() {
      if(editor.sourceMode!=='wysiwyg'){void editor.runSourceCommand('copy');return;}
      /*
      if(!editor.editor){
        return;
      }
      
      const {state}=editor.editor;
      const {$from,$to} = state.selection;
      // console.log(view.dom.innerText,$anchor,$from,$to);
      // const node=getNodeAtPos(state,$anchor.pos);
      // const node=view.nodeDOM(state.selection.$anchor.pos);
      // @ts-ignore
      // const node = editor.editor?.view.;
      // const text=view.dom.innerText.substring($from.pos-1,$to.pos-1);
      const text=state.doc.textBetween($from.pos,$to.pos,'\n','\t');
      // const text=editor.editor.getText().substring($from.pos-1,$to.pos-$to.parentOffset);
      // console.log('copy',node, text);
      if(text){
        writeText(text);
      }
      // state.text=null;
      */
      editor.editor.commands.focus();
     document.execCommand('copy');
    },
  },
  {
    label: t('paste'),
    disabled:false,
    async onClick(){
      if(editor.sourceMode!=='wysiwyg')return editor.runSourceCommand('paste');
      return pasteFromClipboard(editor.editor);
    }
  },
  {
    label: t('cut'),
    disabled() {
      if(editor.sourceMode!=='wysiwyg')return !editor.hasSourceSelection();
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    onClick(){
      if(editor.sourceMode!=='wysiwyg'){void editor.runSourceCommand('cut');return;}
      editor.editor.commands.focus();
      document.execCommand('cut');
    },
    split:true,
  },
  {
    label: t('copyPlainText'),
    disabled() {
      if(editor.sourceMode!=='wysiwyg')return !editor.hasSourceSelection();
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    onClick() {
      if(editor.sourceMode!=='wysiwyg'){void editor.runSourceCommand('copy');return;}
      
      if(!editor.editor){
        return;
      }
      editor.editor.commands.focus();
      const {state}=editor.editor;
      const {$from,$to} = state.selection;
      const text=state.doc.textBetween($from.pos,$to.pos,'\n','\t');
      if(text){
        writeText(text);
      }
      
    },
  },
  {
    label: t('pastePlainText'),
    disabled:false,
    onClick(){
      if(editor.sourceMode!=='wysiwyg'){void editor.runSourceCommand('paste');return;}
      if(appStore.lifecycleBusy || editor.editor?.isEditable === false)return;
      editor.editor.commands.focus();
      const currentEditor=editor.editor;
      const currentDocument=currentEditor.state.doc;
      readText().then((text)=>{
        if(text&&editor.editor===currentEditor && !appStore.lifecycleBusy && currentEditor.isEditable !== false && currentEditor.state.doc===currentDocument){
          const {state,view}=editor.editor;
          view.dispatch(state.tr.insertText(text));
          
        }
      })
      
    },
    split:true,
  },
  {
    label: t('selectAll'),
    disabled:false,
    onClick(){
      if(editor.sourceMode!=='wysiwyg'){void editor.runSourceCommand('selectAll');return;}
      if(!editor.editor){
        return;
      }
      editor.editor.commands.selectAll();
      editor.editor.commands.focus();
    },
    split:true,
  },
  {
    label: t('newLine'),
    disabled:false,
    onClick(){
      if(editor.sourceMode!=='wysiwyg'){
        const {from,to}=editor.sourceSelection;
        const markdown=editor.getMarkdown();
        if(typeof markdown==='string')void editor.replaceSourceRanges([{from,to,replacement:'\n'}],markdown);
        return;
      }
      if(!editor.editor){
        return;
      }
      if(editor.editor.isActive('codeBlock')){
        editor.editor.commands.exitCode();
        // editor.editor.commands.keyboardShortcut('Mod-Enter');
      }else{
        editor.editor.commands.enter();
      }
      
      
      
      editor.editor.commands.focus();
    }
  }
  
]);



</script>

<style lang="scss">
.marknote-layout {
  overflow: hidden;
  display: flex;

  .layout-outliner {
    flex-basis: 200px;
    height: 100vh;
  }
  .layout-folder {
    flex-basis: 200px;
    height: 100vh;
  }

  .layout-content {
    position: relative;
    flex: 1;
    overflow: hidden;
    padding-top: var(--titleBarHeight);

    // &>div {
    //   max-height: calc(100vh - var(--titleBarHeight));
    //   overflow: auto;
    // }
  }
  .document-notice {
    position:absolute;
    bottom:40px;
    left:12px;
    right:12px;
    z-index:20;
    display:flex;
    align-items:center;
    justify-content:space-between;
    flex-wrap:wrap;
    gap:8px;
    padding:10px 12px;
    border:1px solid var(--contentBorderColor);
    border-radius:4px;
    background:var(--contentBackgroundColor);
    color:var(--contentTextColor);
    font-size:13px;
    .document-notice-actions { display:flex;flex-wrap:wrap;gap:8px; }
    button { min-height:30px;padding:4px 8px;background:var(--contentBackgroundColorActive);color:inherit;border:1px solid var(--contentBorderColor);border-radius:4px;cursor:pointer; }
    button:disabled { opacity:.55;cursor:default; }
    button:focus-visible { outline:2px solid var(--primaryTextColorActive);outline-offset:2px; }
  }
}
</style>
