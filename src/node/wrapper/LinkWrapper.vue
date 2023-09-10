<template>
  <NodeViewWrapper class="marknote-link" >
    <div class="link-wrapper" contenteditable="false">
      <NInput></NInput>
    </div>
    <NodeViewContent as="a"></NodeViewContent>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import { NInput } from 'naive-ui';
import { Copy,IndentRight } from '@icon-park/vue-next';
import { NodeViewContent, NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
import { writeText } from '@tauri-apps/api/clipboard';
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
const value = ref(props.node.attrs.language || '');

const contentRef=ref<HTMLElement>();

const handleClick=()=>{
  
  const text=contentRef.value?.innerText;
  console.log('copy',text);
  if(text)
  writeText(text);
}

const handleTabClick=()=>{
  const state=props.editor.state;
  const tr=state.tr.insertText('  ');
  state.apply(tr);
  console.log('tab');
  // props.editor.commands.insertContent('  ');
}

</script>

<style lang="scss">
.marknote-codeblock {
  position: relative;

  .codeblock-wrapper {
    width: 100%;
    display: flex;
    justify-content: space-between;

    .n-select {
      width: 150px;
    }

    .n-button {}
  }

  &>pre.codeblock-pre {
    margin-top: 0;
    padding: 0px 1rem;

    code {
      display: block;
      outline: none;
      margin: 0;
      padding: 0;

    }
  }
}</style>