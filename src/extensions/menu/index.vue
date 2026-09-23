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
          <ElButton size="small" @click="editor.chain().focus().toggleStrike().run()">
            <svg class="icon-svg i-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path d="M968 542.9V481c0-1.7-0.5-3-2.3-3H571.6l-0.5-0.1c-10.7-2.1-21.6-4.2-32.5-6.2-16.9-3.1-23.2-4.3-31.8-6-53.1-10.4-85.4-20.7-111.6-35.8-37.9-22.1-56.3-52.2-56.3-92 0-39.7 16.4-72.8 47.3-95.7 30.1-22.3 72.8-34 123.3-34 57.8 0 102.6 15.3 133.1 45.5 15.6 15.4 27.1 34.3 34 56.2 1.6 4.9 3.1 11.4 4.6 18.8 0.5 2.5 2.7 4.3 5.3 4.3h75c2.9 0 5.4-2.3 5.4-5.2v-0.8c-1-6.8-1.3-12.1-2-15.9-7.3-43.8-28-82-59.9-110.8-44.7-40.8-110.8-62.4-191-62.4-73.4 0-139.4 18.3-185.9 51.5-25.8 18.6-45.6 41.4-58.8 67.9-13.4 27.2-20.3 58.7-20.3 93.5 0 29.5 5.6 54.5 17.2 76.5 8.2 15.5 19.3 29.2 34 41.9l10.2 8.8H59.2c-1.8 0-4.2 1.4-4.2 3.1V543c0 1.8 2.4 3 4.2 3h446.7l0.5 0.2c1.3 0.3 2.6 0.6 3.8 0.8 0.8 0.2 1.5 0.3 2.3 0.5 33 6.6 51.7 10.9 69 15.8 24.3 6.9 42.8 14.1 58 22.6 38.7 21.8 57.5 53.2 57.5 96 0 37.9-16.6 71.8-46.8 95.4-32.2 25.2-79.7 38.6-137.5 38.6-45.6 0-84.6-8.9-116-26.4-30.9-17.3-52.4-42.3-63.8-74.3-0.9-2.4-1.8-5.8-2.9-9.9-0.6-2.3-2.8-4.3-5.2-4.3h-82.1c-3 0-5.7 3-5.7 6v0.8c0 2.2 0.5 4.1 0.7 5.4 6.5 48.9 30.4 89 70.9 119 47.6 35.2 115 53.8 194.6 53.8 85.6 0 157.4-20.1 207.3-58 25-18.9 44.3-42.2 57.3-69.3 13.1-27.4 19.8-58.4 19.8-92.1 0-32-5.8-58.6-17.8-81.5-5.7-11.1-13-21.4-21.7-30.7l-7.9-8.5h225.3c2 0.1 2.5-1.3 2.5-3z"></path></svg>
          </ElButton>
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
import {useEditorStore} from '../../store/editor';
import {storeToRefs} from 'pinia';
import {TextBold,TextItalic,Code,Link} from '@icon-park/vue-next';
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
.icon-svg{
  width:1em;
  height:1em;
  fill: var(--contentTextColor);
}
</style>