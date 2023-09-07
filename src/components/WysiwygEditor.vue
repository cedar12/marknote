<template>
  <div class="editor-container">
    <!-- <button @click="onPrint">print</button> -->
   <!-- <BubbleTable v-if="editorStore.editor" :editor="editorStore.editor"></BubbleTable> 
    <BubbleMenu v-if="editorStore.editor" :editor="editorStore.editor" :should-show="shouldShowText">
      <button @click="editorStore.editor.chain().focus().toggleBold().run()">加粗</button>
      <button @click="editorStore.editor.chain().focus().toggleItalic().run()">斜体</button>
      <button @click="editorStore.editor.chain().focus().toggleStrike().run()">删除线</button>
      <button @click="editorStore.editor.chain().focus().toggleCode().run()">代码</button>
    </BubbleMenu>
    <editor-content :editor="editorStore.editor" ></editor-content> -->
    <div class="bubbel-table" ref="bubbleTableRef">
      <button @click="editorStore.chain()?.focus().addColumnAfter().run()">增加列</button>
      <button @click="editorStore.chain()?.focus().deleteColumn().run()">删除列</button>
      <button @click="editorStore.chain()?.focus().addRowAfter().run()">增加行</button>
      <button @click="editorStore.chain()?.focus().deleteRow().run()">删除行</button>
      <button @click="editorStore.chain()?.focus().mergeOrSplit().run()">合并单元格</button>
      <button @click="editorStore.chain()?.focus().toggleHeaderRow().run()">表头</button>
    </div>
    <div ref="editorRef" @contextmenu.prevent="">

    </div>
  </div>
  
</template>

<script setup lang="ts">
import {onMounted,ref} from 'vue'

import 'highlight.js/scss/github.scss'

// import {md2html} from '../utils/parser'

import {useEditorStore} from '../store/editor';
import BubbleMenu from '@tiptap/extension-bubble-menu'

const editorStore=useEditorStore();

const editorRef=ref<HTMLElement>();
const bubbleTableRef=ref<HTMLElement>();



onMounted(()=>{
  const content=`所见即所得  🎉
  # marknote
  2. 1
  3. 2
  * [x] a
  * [x] b
  \`\`\` javascript
  console.log(123);
  \`\`\`

  > a~bc~

  ~abc~

  |a |b |
  |:-|:-|
  |1 |2 |
  `;
  if(editorRef.value)
  editorStore.create(editorRef.value,[
    BubbleMenu.configure({
      shouldShow: ({ editor }) => {
        return false;//editor.isActive('table')
      },
      element:bubbleTableRef.value
    })
  ]);
  editorStore.setContent(content);

});

</script>
