<template>
  <BubbleMenu v-if="editor" :editor="editor">
    <LinkMenu :editor="editor"/>
  </BubbleMenu>
  <EditorContent :editor="editor"/>
</template>
<script lang="ts" setup> 
import {onMounted} from 'vue';
import {EditorContent,BubbleMenu} from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor2';
import { storeToRefs } from 'pinia';
import LinkMenu from './menu/link/index.vue';

const editorStore=useEditorStore();

const {editor} = storeToRefs(editorStore);
  
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
  setTimeout(() => {
    editor.value?.commands.setContent(content);  
  }, 500);
  
})

</script>