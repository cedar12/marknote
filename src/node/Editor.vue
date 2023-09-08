<template>
  <EditorContent :editor="editor"/>
</template>
<script lang="ts" setup> 
import {onMounted} from 'vue';
import {EditorContent} from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor2';
import { storeToRefs } from 'pinia';

const editorStore=useEditorStore();

const {editor} = storeToRefs(editorStore);
  
onMounted(()=>{
  const content=`所见即所得  🎉
  # marknote
  2. 1
  3. 2
  * [x] a
  * [x] b
import { storeToRefs } from 'pinia';
  \`\`\` javascript
  console.log(123);
  \`\`\`

  > a~bc~

  ~abc~

  |a |b |
  |:-|:-|
  |1 |2 |
  `;
  console.log(editor);
  editor.value?.commands.setContent(content);
})

</script>