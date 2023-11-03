<template>
    <!-- <LinkMenu :editor="editor"></LinkMenu> -->
  <Menu></Menu>
  <EditorContent :editor="editor" ></EditorContent>
</template>
<script lang="ts" setup> 
import {onMounted,watch,nextTick} from 'vue';
import {EditorContent} from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor';
import {useAppStore} from '../store/app';
import { storeToRefs } from 'pinia';
import Menu from '../extensions/menu/index.vue';

// import {createEditor} from '../utils/editor';
const appStore=useAppStore();
const editorStore=useEditorStore();

// const editor=createEditor();

const {editor} = storeToRefs(editorStore);


watch(()=>appStore.filepath,()=>{
  editorStore.updateHeadings();
})

onMounted(()=>{
  
/*
  const content=`
  # marknote
  所见即所得  🎉
  
  2. 1
  3. 2
  * [x] a
  * [x] b
  
  \`\`\` javascript
  console.log('marknote');
  \`\`\`

  > a~~bc~~

  ~~abc~~ **bold**

  |a |b |
  |:-|:-|
  |1 |2 |


  abc [baidu.com](https://www.baidu.com)
  \`\`\`rust
  fn main(){
    println!("marknote");
  }
  \`\`\`
  `;
  // console.log('mount editor',editor);

  */
  nextTick(()=>{
    // editorStore.setContent(content);
    editor.value.commands.focus();
    editor.value.on('update', editorStore.updateHeadings);
    editorStore.updateHeadings();
  })
  
})

</script>