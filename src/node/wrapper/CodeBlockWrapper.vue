<template>
  <NodeViewWrapper class="marknote-codeblock">
    <div class="codeblock-wrapper">
      <NSelect size="small" v-model:value="value" :options="props.extension.options.lowlight.listLanguages().map((v:string)=>({label:v,value:v}))" :disabled="!isEditable" @update:value="props.updateAttributes({ language: value })"></NSelect>
      <NTooltip size="small">
        <template #trigger>
          <NButton size="small">
            <template #icon>
              <n-icon>
                <Copy></Copy>
              </n-icon>
            </template>
          </NButton>
        </template>
        <span>复制</span>
      </NTooltip>
    </div>
    <pre>
        <NodeViewContent as="code"></NodeViewContent>
    </pre>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { NSelect, NTooltip, NButton, NIcon } from 'naive-ui';
import { Copy } from '@icon-park/vue-next';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
const value = ref(props.node.attrs.language || '');
//extension.options.lowlight.listLanguages()



</script>

<style lang="scss">
.marknote-codeblock {
  position: relative;

  .codeblock-wrapper {
    width: 100%;
    display: flex;
    justify-content: space-between;

    .n-select {
      width: 100px;
    }

    .n-button {}
  }

  pre {
    margin-top: 0;

    code {
      width: 100%;
    }
  }
}</style>