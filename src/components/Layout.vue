<template>
  <div class="marknote-layout">
    <div class="layout-outliner" v-if="appStore.visible.outliner">
      <Outliner></Outliner>
    </div>
    <div class="layout-content">
      <ContextMenu :menu="menuItems">
        <WysiwygEditor />
      </ContextMenu>

    </div>

  </div>
</template>
<script lang="ts" setup>
import { ref,reactive } from 'vue';
// import WysiwygEditor from "./WysiwygEditor.vue";
import WysiwygEditor from "../node/Editor.vue";
import ContextMenu from "./contextMenu/index.vue";
import { ContextMenuItem } from "./contextMenu/useContextMenu";
import { useI18n } from 'vue-i18n';
import { useEditorStore } from '../store/editor2';
import Outliner from './Outliner.vue';
import { writeText } from '@tauri-apps/api/clipboard';
import {useAppStore} from '../store/app';
// import {readText,writeText} from '@tauri-apps/api/clipboard';

const { t } = useI18n();
const appStore=useAppStore();

const editor = useEditorStore();

const state=reactive({text:null});

const menuItems = ref<ContextMenuItem[]>([
  {
    label: t('copy'),
    disabled() {
      // @ts-ignore
      const node = editor.editor?.view?.domSelectionRange().anchorNode;
      const text=node.textContent;
      if(text===null){
        state.text = text;
      }
      console.log('------->',text);
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
    split: true,
    onClick(item: ContextMenuItem) {
      console.log(item, state.text);
      const str=state.text;
      if(str){
        writeText(str);
      }
      state.text=null;
    },
  },
  {
    label: t('paste'),
    disabled() {
      const content = editor.editor?.state.selection.content();
      return content?.size === 0;
    },
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

    &>div {
      max-height: calc(100vh - var(--titleBarHeight));
      overflow: auto;
    }
  }
}
</style>