<template>
  <div class="marknote-layout">
    <!-- <div class="layout-outliner" v-if="appStore.visible.outliner">
      <Outliner></Outliner>
    </div>
    <div class="layout-folder" v-if="appStore.visible.folder">
      <Folder></Folder>
    </div> -->
    <Sidebar></Sidebar>
    <div class="layout-content" :class="`code-theme-${editor.codeTheme} ${appStore.exporting?'exporting':''}`" v-loading="appStore.exporting||editor.loading">
      <ContextMenu :menu="menuItems">
        <ElScrollbar class="layout-scrollbar" height="calc(100vh - var(--titleBarHeight))">
          <Editor></Editor>
        </ElScrollbar>
      </ContextMenu>

    </div>
    <Dialog></Dialog>
  </div>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
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
// import {triggerPaste} from '../api/utils';

const { t } = useI18n();
const appStore=useAppStore();

const editor = useEditorStore();


const menuItems = ref<ContextMenuItem[]>([
  
  {
    label: t('copy'),
    disabled() {
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    onClick() {
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
    onClick(){
      // readText().then((text)=>{
      //   if(text&&editor.editor){
      //     // const {state,view}=editor.editor;
      //     // view.dispatch(state.tr.insertText(text));
          
      //   }
      // })
      editor.editor.commands.focus();
      // triggerPaste();
      window.navigator.clipboard.read().then(async c=>{
        if(c.length==0)return;
        const res=await c[0].getType('text/html');
        // console.log(res);
        return res.text();
      }).then((res:any)=>{
        // console.log(res);
        if(res)
        editor.editor.commands.insertContent(res);
      }).catch(e=>{
        console.error(e);
      })
    }
  },
  {
    label: t('cut'),
    disabled() {
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    onClick(){
      editor.editor.commands.focus();
      document.execCommand('cut');
    },
    split:true,
  },
  {
    label: t('copyPlainText'),
    disabled() {
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    onClick() {
      
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
      editor.editor.commands.focus();
      readText().then((text)=>{
        if(text&&editor.editor){
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
    flex: 1;
    overflow: hidden;
    padding-top: var(--titleBarHeight);

    // &>div {
    //   max-height: calc(100vh - var(--titleBarHeight));
    //   overflow: auto;
    // }
  }
}
</style>