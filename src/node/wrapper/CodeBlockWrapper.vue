<template>
  <NodeViewWrapper class="marknote-codeblock" >
    <div class="codeblock-wrapper" contenteditable="false" v-if="props.editor.isActive('codeBlock')">
      <NSelect filterable size="small" v-model:value="value" tabindex="-1"
        :options="props.extension.options.lowlight.listLanguages().map((v: string) => ({ label: v, value: v }))"
        :disabled="!isEditable" @update:value="props.updateAttributes({ language: value })"></NSelect>
      <NButtonGroup>
        <!-- <NTooltip size="small">
          <template #trigger>
            <NButton size="small" @click="handleTabClick" tabindex="-1">
              <template #icon>
                <n-icon>
                  <IndentRight></IndentRight>
                </n-icon>
              </template>
            </NButton>
          </template>
          <span>Tab</span>
        </NTooltip> -->
        <NTooltip size="small">
          <template #trigger>
            <NButton size="small" @click="handleClick" tabindex="-1">
              <template #icon>
                <n-icon>
                  <Copy></Copy>
                </n-icon>
              </template>
            </NButton>
          </template>
          <span>复制</span>
        </NTooltip>
      </NButtonGroup>
    </div>
    <div ref="contentRef" >
      <NodeViewContent as="code" ></NodeViewContent>
    </div>
    <!-- <pre class="codeblock-pre" ref="contentRef"> -->
        
    <!-- </pre> -->
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import { NSelect, NTooltip, NButton, NIcon ,NButtonGroup } from 'naive-ui';
import { Copy,IndentRight } from '@icon-park/vue-next';
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

const handleTabClick=()=>{
  const state=props.editor.state;
  const tr=state.tr.insertText('\t');
  props.editor.view.dispatch(tr);
  console.log('tab');
  // props.editor.commands.insertContent('  ');
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