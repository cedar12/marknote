<template>
  <div>
    <!-- <button @click="onPrint">print</button> -->
   <!-- <BubbleTable v-if="editorStore.editor" :editor="editorStore.editor"></BubbleTable> 
    <BubbleMenu v-if="editorStore.editor" :editor="editorStore.editor" :should-show="shouldShowText">
      <button @click="editorStore.editor.chain().focus().toggleBold().run()">加粗</button>
      <button @click="editorStore.editor.chain().focus().toggleItalic().run()">斜体</button>
      <button @click="editorStore.editor.chain().focus().toggleStrike().run()">删除线</button>
      <button @click="editorStore.editor.chain().focus().toggleCode().run()">代码</button>
    </BubbleMenu>
    <editor-content :editor="editorStore.editor" ></editor-content> -->
    <div ref="editorRef">

    </div>
  </div>
  
</template>

<script setup lang="ts">
import {onMounted,ref} from 'vue'

import 'highlight.js/scss/github.scss'

// import {md2html} from '../utils/parser'

import {useEditorStore} from '../store/editor';

const editorStore=useEditorStore();

const editorRef=ref<HTMLElement>();



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
  editorStore.create(editorRef.value);
  editorStore.setContent(content);

});


const onPrint=()=>{
  // if(editorStore.editor){
  //   // var md=html2md(editor.value?.getHTML());
  //   var md=editorStore.editor.storage.markdown.getMarkdown();
  //   console.log(md);
  //   console.log(editorStore.editor.getJSON());
  // }
  console.log(editorStore.getMarkdown());
}


// watch(()=>editorStore.content,()=>{
//   editorStore.editor?.commands.setContent(editorStore.content);
// })
</script>
