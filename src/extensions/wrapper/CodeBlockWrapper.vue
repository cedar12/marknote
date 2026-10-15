<template>
  <NodeViewWrapper class="marknote-codeblock" :class="{ 'marknote-mermaid': isMermaid(), hljs: !isMermaid() }" ref="wrapperRef">
    <div class="codeblock-wrapper" :class="{ active: isFocus() }" :aria-hidden="isMermaid() && !isFocus()" contenteditable="false">
      <ElSelect class="left-wrapper" clearable filterable size="small" v-model="value" :placeholder="t('codeLanguageAuto')"
        :disabled="!props.editor.isEditable" :fit-input-width="true" v-control-a11y="{ label: t('codeLanguage') }"
        @change="onChangeLanguage">
        <ElOption v-for="item in options()" :key="item" :label="item" :value="item"></ElOption>
      </ElSelect>
      <div class="right-wrapper">
        <BlockSourceActions v-if="isMermaid()" :source="props.node.textContent" v-model:show-code="showCode" />
        <BlockSourceActions v-else :source="props.node.textContent" />
      </div>
    </div>
    <pre class="hljs block-source" v-show="!isMermaid()||showCode">
      <NodeViewContent as="code"></NodeViewContent>
    </pre>
    <div v-if="isMermaid()" class="mermaid-render" v-html="mermaidValue" contenteditable="false" ></div>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref,onMounted,watch,getCurrentInstance  } from 'vue';
import {ElSelect,ElOption} from 'element-plus';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import mermaid from 'mermaid';
import { listen } from '@tauri-apps/api/event';
import BlockSourceActions from './BlockSourceActions.vue';
import { useI18n } from 'vue-i18n';
import { vControlA11y } from '../../directives/controlA11y';



const instance=getCurrentInstance();
const props = defineProps(nodeViewProps);
const { t } = useI18n();

const value = ref(props.node.attrs.language || '');
const showCode=ref(false);

const wrapperRef=ref<HTMLElement>();

const mermaidValue=ref<string>();

const isMermaid=()=>{
  return props.node.attrs.language==='mermaid';
}

const options=()=>{
  const list=props.extension.options.lowlight.listLanguages();

  return [...list,'mermaid'];
}
const onChangeLanguage = () => {
  if (!props.editor.isEditable) {
    value.value = props.node.attrs.language || '';
    return;
  }
  // A persistent toolbar can be used while the caret is in another paragraph.
  // Keep the source controls reachable when the block becomes a diagram.
  if (value.value === 'mermaid' && !isFocus()) {
    props.editor.commands.setTextSelection(props.getPos() + 1);
  }
  props.updateAttributes({ language: value.value });
};

watch(() => props.node.attrs.language, language => {
  value.value = language || '';
  void renderMermaid();
});



const renderMermaid=async ()=>{
  if(props.node.attrs.language==='mermaid'&&instance){
    try {
      const svg = await mermaid.render('mermaid_'+instance.uid,props.node.textContent);
      mermaidValue.value=svg.svg;
    } catch {
      mermaidValue.value = undefined;
      showCode.value = true;
    }
  }
}

const isFocus=()=>{
  
  const {anchor}=props.editor.state.selection;
  const node=props.node;
  const pos=props.getPos();
  //console.log(anchor,pos,node.nodeSize,node);
  const is=props.editor.isActive('codeBlock')&&anchor >= pos &&anchor <= pos + node.nodeSize-1;
  //&&(anchor == pos && anchor <= pos + node.nodeSize )
  // console.log(node,pos,anchor);
  return is;
}

watch(()=>props.node.textContent,async ()=>{
  renderMermaid();
});

onMounted(async ()=>{
  // console.log(props.node.attrs.language);
  renderMermaid();
  listen('theme', (event) => {
    const value:any=event.payload;
    mermaid.initialize({
      theme: value.type==='light'?'default':'dark',
    });
    renderMermaid();
    
  });
})

</script>

<style lang="scss">
.marknote-codeblock {
  position: relative;
  min-width: 0;

  .codeblock-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
    padding: 5px 10px;
    min-height: 34px;
    font-family: var(--fontFamily);
    color: inherit;

    .left-wrapper{
      flex: 0 1 168px;
      min-width: 0;
      border-radius: 4px;
      &:focus-within { outline: 2px solid var(--primaryBorderColor); outline-offset: 1px; }
    }
    .right-wrapper{
      flex: none;
    }
    .el-select {
      width: 168px;
      --el-select-border-color-hover: transparent;
      --el-select-input-focus-border-color: transparent;
    }
    .el-input {
      --el-input-text-color: currentColor;
      --el-input-placeholder-color: currentColor;
      --el-input-icon-color: currentColor;
      --el-input-hover-border-color: transparent;
      --el-input-focus-border-color: transparent;
      font-size: 12px;
    }
    .el-input__wrapper{
      background-color: transparent;
      box-shadow: none;
      padding-inline: 6px;
    }
    .el-input__suffix {
      color: inherit;
    }
    .el-select__caret {
      opacity: .6;
    }
    .block-source-actions .el-button {
      width: 24px;
      height: 24px;
      padding: 4px;
      border-color: transparent;
      color: inherit;
      cursor: pointer;

      &:hover { background-color: var(--contentBackgroundColorActive); color: var(--contentTextColorActive); }
      &:active { background-color: var(--contentBorderColor); color: var(--contentBackgroundColor); }
      &:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 1px; }
      &[aria-busy="true"] { cursor: progress; }
    }
  }
  > pre.block-source {
    margin: 0;
    padding: 12px 16px;
    overflow-x: auto;
  }

  &:not(.marknote-mermaid) {
    border-radius: 4px;

    // Use the selected syntax theme's foreground for a quiet, matching frame.
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px solid currentColor;
      border-radius: inherit;
      opacity: .14;
      pointer-events: none;
    }

    .codeblock-wrapper {
      border-radius: 4px 4px 0 0;

      &::before, &::after {
        content: '';
        position: absolute;
        pointer-events: none;
      }
      &::before {
        inset: 0;
        border-radius: inherit;
        background-color: currentColor;
        opacity: .04;
      }
      &::after {
        inset: auto 0 0;
        border-bottom: 1px solid currentColor;
        opacity: .1;
      }
    }
  }

  &.marknote-mermaid .codeblock-wrapper {
    visibility: hidden;
    &.active, &:focus-within { visibility: visible; }
  }
  .mermaid-render{
    display:flex;
    justify-content: center;
    padding-top: .4em;
  }
  
}

.marknote .marknote-codeblock:not(.marknote-mermaid) > pre.block-source {
  background: transparent;
  color: inherit;
  border: 0;
  border-radius: 0 0 4px 4px;
  box-shadow: none;
}
.exporting{
  .marknote-codeblock{
    .codeblock-wrapper {
      .el-button,.el-input__suffix{
        opacity: 0;
      }
    }
  }
}
</style>
