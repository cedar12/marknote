<template>
  <NodeViewWrapper class="marknote-link" >
    <div class="link-wrapper" contenteditable="false" v-if="!isEditable">
      <ElInput v-model="value"></ElInput>
    </div>
    <NodeViewContent as="a"></NodeViewContent>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import {ElInput} from 'element-plus';
import { NodeViewContent, NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
const value = ref(props.node.attrs.language || '');

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