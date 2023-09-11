<template>
  <NodeViewWrapper class="marknote-codeblock" >
    <div class="codeblock-wrapper" contenteditable="false" v-if="props.editor.isActive('codeBlock')">
      <ElSelect filterable size="small" v-model="value" placeholder=""
        :disabled="!isEditable" @change="props.updateAttributes({ language: value })">
        <ElOption v-for="item in props.extension.options.lowlight.listLanguages()" :key="item" :label="item" :value="item"></ElOption>
      </ElSelect>
      <div>
        <ElTooltip size="small " content="复制">
          <ElButton size="small" @click="handleClick" tabindex="-1">
              <Copy></Copy>
          </ElButton>
        </ElTooltip>
      </div>
    </div>
    <div ref="contentRef" >
      <NodeViewContent as="code" ></NodeViewContent>
    </div>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import {ElSelect,ElOption,ElButton,ElTooltip} from 'element-plus';
import { Copy } from '@icon-park/vue-next';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { writeText } from '@tauri-apps/api/clipboard';
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
const value = ref(props.node.attrs.language || '');

const contentRef=ref<HTMLElement>();

const handleClick=()=>{
  
  const text=(contentRef.value?.children[0] as HTMLElement).innerText;
  console.log('copy',text);
  if(text)
  writeText(text);
}

</script>

<style lang="scss">
.marknote-codeblock {
  position: relative;

  .codeblock-wrapper {
    display: flex;
    justify-content: space-between;

    .n-select {
      width: 150px;
    }

    .n-button {}
  }
  div{
    height: auto !important;
    code {
      padding: 1em;
      margin: 0;
      pointer-events: all;
      background-color: #f1f3f5;
      display: block;
    }
  }
  
}</style>