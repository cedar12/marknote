<template>
  <BubbleMenu v-if="editor" :editor="editor">
    <LinkMenu :editor="editor"></LinkMenu>
  </BubbleMenu>
  <EditorContent :editor="editor" v-loading="editorStore.loading"></EditorContent>
</template>
<script lang="ts" setup> 
import {onMounted,nextTick} from 'vue';
import {EditorContent,BubbleMenu} from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor2';
import LinkMenu from './menu/link/index.vue';
import {editor,setContent} from '../utils/editor';

const editorStore=useEditorStore();
  
onMounted(()=>{
  const content=`# marknote
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
  console.log('mount editor',editor);

  // setTimeout(() => {
    
  // }, 500);
  nextTick(()=>{
    setContent(content);
  })
  
})

</script>