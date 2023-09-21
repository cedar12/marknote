<template>
  <BubbleMenu v-if="editor" plugin-key="text-bubble-menu" :should-show="shouldShow" :editor="editor" :tippy-options="{ duration: 100 }">
      <ElButtonGroup>
        <ElTooltip content="加粗">
          <ElButton size="small" :icon="TextBold" @click="editor.chain().focus().toggleBold().run()"></ElButton>
        </ElTooltip>
        <ElTooltip content="斜体">
          <ElButton size="small" :icon="TextItalic"  @click="editor.chain().focus().toggleItalic().run()"></ElButton>
        </ElTooltip>
        <ElTooltip content="链接">
          <ElButton size="small" :icon="Link" @click=""></ElButton>
        </ElTooltip>
        <ElTooltip content="代码">
          <ElButton size="small" :icon="Code" @click="editor.chain().focus().toggleCode().run()"></ElButton>
        </ElTooltip>
        
      </ElButtonGroup>
  </BubbleMenu>
</template>
<script  lang="ts" setup>
import {BubbleMenu} from '@tiptap/vue-3';
import {ElButtonGroup,ElButton,ElTooltip} from 'element-plus';
// import {ref,reactive,watch} from 'vue';
import {useEditorStore} from '../../store/editor';
import {storeToRefs} from 'pinia';
import {TextBold,TextItalic,Code,Link} from '@icon-park/vue-next';
import { isTextSelection } from '@tiptap/core';
const editorStore=useEditorStore();
const {editor}=storeToRefs(editorStore);


//@ts-ignore
const shouldShow=({ view, state, from, to }) => {
  const { doc, selection } = state;
  const { empty } = selection;

  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(state.selection);

  if (!view.hasFocus() || empty || isEmptyTextBlock || editor.value.isActive('katex')||editor.value.isActive('codeBlock')) {
    return false;
  }

  return true;
};
</script>