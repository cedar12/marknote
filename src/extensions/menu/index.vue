<template>
  <BubbleMenu v-if="editor" plugin-key="text-bubble-menu" :should-show="shouldShow" :editor="editor" :tippy-options="{ duration: 100 }">
    <div class="bubble-menu-group">
      <ElButtonGroup>
        <ElTooltip content="加粗">
          <ElButton size="small" :icon="TextBold" @click="editor.chain().focus().toggleBold().run()"></ElButton>
        </ElTooltip>
        <ElTooltip content="斜体">
          <ElButton size="small" :icon="TextItalic"  @click="editor.chain().focus().toggleItalic().run()"></ElButton>
        </ElTooltip>
        <ElTooltip content="删除线">
          <ElButton size="small" :icon="Minus" @click="editor.chain().focus().toggleStrike().run()"></ElButton>
        </ElTooltip>
        <ElTooltip content="链接">
          <ElButton size="small" :icon="Link" @click="onClickLink"></ElButton>
        </ElTooltip>
        <ElTooltip content="代码">
          <ElButton size="small" :icon="Code" @click="editor.chain().focus().toggleCode().run()"></ElButton>
        </ElTooltip>
        
        
      </ElButtonGroup>
    </div>
  </BubbleMenu>
</template>
<script  lang="ts" setup>
import {BubbleMenu} from '@tiptap/vue-3';
import {ElButtonGroup,ElButton,ElTooltip} from 'element-plus';
// import {ref,reactive,watch} from 'vue';
import {useEditorStore} from '../../store/editor';
import {storeToRefs} from 'pinia';
import {TextBold,TextItalic,Code,Link,Minus} from '@icon-park/vue-next';
import { isTextSelection } from '@tiptap/core';
const editorStore=useEditorStore();
const {editor}=storeToRefs(editorStore);

const excludes=['table','katex','codeBlock','image','horizontalRule'];

//@ts-ignore
const shouldShow=({ view, state, from, to }) => {
  const { doc, selection } = state;
  const { empty } = selection;

  const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(state.selection);
  const findType=excludes.find((e)=>editor.value.isActive(e));
  if (!view.hasFocus() || empty || isEmptyTextBlock || (findType&&findType.length>0)) {
    return false;
  }

  return true;
};


const onClickLink=()=>{
  if(editor.value.isActive('link')){
    editor.value.commands.unsetLink();
  }else{
    editor.value.commands.setLink({href:''});
  }
}
</script>
<style>
.bubble-menu-group{
  background-color: var(--contentBackgroundColor);
}
</style>