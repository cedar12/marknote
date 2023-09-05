<template>
  <div>
    <button @click="onPrint">print</button>
   <BubbleTable v-if="editor" :editor="editor"></BubbleTable> 
    <BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShowText">
      <button @click="editor.chain().focus().toggleBold().run()">加粗</button>
      <button @click="editor.chain().focus().toggleItalic().run()">斜体</button>
      <button @click="editor.chain().focus().toggleStrike().run()">删除线</button>
      <button @click="editor.chain().focus().toggleCode().run()">代码</button>
    </BubbleMenu>
    <editor-content :editor="editor" ></editor-content>
  </div>
  
</template>

<script setup lang="ts">
import {onMounted,watch} from 'vue'
import { useEditor, EditorContent ,BubbleMenu } from '@tiptap/vue-3'
import {  wrappingInputRule } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

import BubbleTable from './bubble/BubbleTable.vue'

// load all highlight.js languages
import { lowlight } from '../utils/lowlight'

import 'highlight.js/scss/github.scss'

import {md2html,html2md} from '../utils/parser'

import {useEditorStore} from '../store/editor';

const editorStore=useEditorStore();


const shouldShowText= (props:any) => {
    return props.editor.isActive('bold')||props.editor.isActive('ltalic')||props.editor.isActive('text')||props.editor.isActive('inline')
}


const MarknoteTable=Table.extend({
  addInputRules() {
    let inputRule = wrappingInputRule({
      find: /^\|{3}\s/,
      type: this.type,
    });
    return [
      inputRule,
    ]
  },
});



var editor = useEditor({
  content: '',
  editorProps:{
    attributes:{
      class:'marknote'
    }
  },
  extensions: [
    StarterKit,
    TaskItem,
    TaskList.configure({
      HTMLAttributes:{
        class: 'marknote-task'
      },
      
    }),
    TableRow,
    TableHeader,
    TableCell,
    MarknoteTable.configure({
      HTMLAttributes:{
        class: 'marknote-table'
      },
      
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
  ],
});

onMounted(async ()=>{
  const content=await md2html(`所见即所得  🎉
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
  `);
  editor.value?.commands.setContent(content)
});


const onPrint=()=>{
  if(editor.value){
    var md=html2md(editor.value?.getHTML());
    console.log(md);
    console.log(editor.value.getJSON());
  }
}


watch(()=>editorStore.content,()=>{
  editor.value?.commands.setContent(editorStore.content);
})
</script>
