<template>
  <NodeViewWrapper class="marknote-link" >
    <ElPopover trigger="hover" placement="top">
      <div class="link-wrapper" contenteditable="false" v-if="!isEditable">
        <ElInput v-model="value" :disabled="!isEditable"></ElInput>
      </div>
      <template #reference>
        <NodeViewContent as="a"></NodeViewContent>
      </template>
    </ElPopover>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref,onMounted } from 'vue';
import {ElInput,ElPopover} from 'element-plus';
import { NodeViewContent, NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
const value = ref(props.node.attrs.language || '');

onMounted(()=>{
  console.log('link',props);
})
</script>

<style lang="scss">
.marknote-link {
  position: relative;

}</style>