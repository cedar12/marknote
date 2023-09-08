<template>
  <div class="marknote-layout">
    
    <div class="layout-content">
      <!-- <ContextMenu :menu="menuItems" > -->
        <WysiwygEditor/>
      <!-- </ContextMenu> -->

    </div>
    
  </div>
  
</template>
<script lang="ts" setup>
import {ref} from 'vue';
// import WysiwygEditor from "./WysiwygEditor.vue";
import WysiwygEditor from "../node/Editor.vue";
import ContextMenu from "./contextMenu/index.vue";
import {ContextMenuItem} from "./contextMenu/useContextMenu";
import {useI18n} from 'vue-i18n';
import {useEditorStore} from '../store/editor';
// import {readText,writeText} from '@tauri-apps/api/clipboard';

const {t} = useI18n();

const editor=useEditorStore();

const menuItems=ref<ContextMenuItem[]>([
  {
    label:t('Copy'),
    disabled() {
        const content=editor.ref()?.state.selection.content();
        return content?.size===0;
    },
    split:true,
    onClick() {
      // const node=editor.ref()?.view.domSelectionRange().anchorNode;
      // console.log(node);
      // if(str)
      // writeText(str);
    },
  },
  {
    label:t('Paste'),
    disabled() {
        const content=editor.ref()?.state.selection.content();
        return content?.size===0;
    },
  }
]);
</script>

<style lang="scss">
.marknote-layout{
  overflow: hidden;
  .layout-content{
    overflow: hidden;
    padding-top: var(--titleBarHeight);
    &>div{
      max-height: calc(100vh - var(--titleBarHeight));
      overflow: auto;
    }
  }
}
</style>