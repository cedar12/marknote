<template>
  <div class="marknote-layout">
    <div class="layout-outliner" v-if="appStore.visible.outliner">
      <Outliner></Outliner>
    </div>
    <div class="layout-content" :class="'code-theme-'+editor.codeTheme">
      <ContextMenu :menu="menuItems">
        <ElScrollbar height="calc(100vh - var(--titleBarHeight))">
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
import Outliner from './Outliner2.vue';
import {useAppStore} from '../store/app';
import {readText,writeText} from '@tauri-apps/api/clipboard';
import {ElScrollbar} from 'element-plus';
import Dialog from './dialog/index.vue';

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
    split: true,
    onClick() {
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
    },
  },
  {
    label: t('paste'),
    disabled:false,
    onClick(){
      readText().then((text)=>{
        if(text&&editor.editor){
          const {state,view}=editor.editor;
          view.dispatch(state.tr.insertText(text))
          
        }
      })
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