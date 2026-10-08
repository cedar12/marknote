<template>
  <NodeViewWrapper class="marknote-codeblock" :class="{'marknote-mermaid':isMermaid()}" ref="wrapperRef">
    <div class="codeblock-wrapper" contenteditable="false" v-show="isFocus()">
      <ElSelect class="left-wrapper" clearable filterable size="small" v-model="value" placeholder="    " 
        :disabled="!isEditable" @change="props.updateAttributes({ language: value })">
        <ElOption v-for="item in options()" :key="item" :label="item" :value="item"></ElOption>
      </ElSelect>
      <div class="right-wrapper">
        <ElTooltip size="small " :content="t('code')" v-if="isMermaid()">
          <ElButton size="small" @click="showCode=!showCode" tabindex="-1">
              <Code></Code>
          </ElButton>
        </ElTooltip>
        <ElTooltip size="small " :content="copyLabel" :trigger="['hover', 'focus']" :trigger-keys="[]">
          <ElButton size="small" :aria-label="copyLabel" :aria-busy="copying" :aria-disabled="copying"
            @pointerdown.stop.prevent @mousedown.stop.prevent @click.stop="handleCopy">
              <Check v-if="copyStatus === 'copied'"></Check>
              <Copy v-else></Copy>
          </ElButton>
        </ElTooltip>
        <span class="copy-status" role="status">{{ copyStatus === 'idle' ? '' : copyLabel }}</span>
        
      </div>
    </div>
    <pre class="hljs" v-show="!isMermaid()||showCode">
      <NodeViewContent as="code"></NodeViewContent>
    </pre>
    <div v-if="isMermaid()" class="mermaid-render" v-html="mermaidValue" contenteditable="false" ></div>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { computed,ref,onMounted,onBeforeUnmount,watch,getCurrentInstance  } from 'vue';
import {ElSelect,ElOption,ElButton,ElTooltip} from 'element-plus';
import { Copy,Code,Check } from '@icon-park/vue-next';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import {useI18n} from 'vue-i18n';
import mermaid from 'mermaid';
import { listen } from '@tauri-apps/api/event';



const instance=getCurrentInstance();
const {t}=useI18n();
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
const value = ref(props.node.attrs.language || '');
const showCode=ref(false);
const copying=ref(false);
const copyStatus=ref<'idle' | 'copied' | 'failed'>('idle');
const copyLabel=computed(()=>t(copyStatus.value === 'copied' ? 'copied' : copyStatus.value === 'failed' ? 'copyFailed' : 'copy'));
let copyStatusTimer: ReturnType<typeof setTimeout> | undefined;
let disposed=false;

const wrapperRef=ref<HTMLElement>();

const mermaidValue=ref<string>();

const isMermaid=()=>{
  return props.node.attrs.language==='mermaid';
}

const options=()=>{
  const list=props.extension.options.lowlight.listLanguages();

  return [...list,'mermaid'];
}



const handleCopy=async ()=>{
  if (copying.value) return;
  copying.value = true;
  copyStatus.value = 'idle';
  clearTimeout(copyStatusTimer);
  try {
    await writeText(props.node.textContent);
    if (disposed) return;
    copyStatus.value = 'copied';
    copyStatusTimer = setTimeout(()=>{ copyStatus.value = 'idle'; }, 2000);
  } catch (error) {
    if (disposed) return;
    copyStatus.value = 'failed';
    console.error('Code block copy failed:', error);
  } finally {
    if (!disposed) copying.value = false;
  }
}

onBeforeUnmount(()=>{
  disposed = true;
  clearTimeout(copyStatusTimer);
});

const renderMermaid=async ()=>{
  if(props.node.attrs.language==='mermaid'&&instance){
    const svg = await mermaid.render('mermaid_'+instance.uid,props.node.textContent);
    mermaidValue.value=svg.svg;
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
  pre{
    tab-size: var(--tabSize,4);
  }
  .codeblock-wrapper {
    display: flex;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 4px 0 4px;
    position: absolute;
    top: 0;
    height:0px;
    .copy-status {
      position: absolute;
      width: 1px;
      height: 1px !important;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .left-wrapper{
      position:absolute;
      
      height: 20px !important;
    }
    .right-wrapper{
      position:absolute;
      right:4px;
    }
    .el-select {
      margin-top: -0.4em;
      width: 110px;
      --el-select-border-color-hover: #ffffff00;
      --el-select-input-focus-border-color: #ffffff00;
      .el-select__caret.el-select__icon{
        opacity:0;
      }
    }
    .el-input__wrapper{
      background-color: transparent;
      box-shadow: none;
    }
    .el-button{
      background-color: transparent;
      &[aria-busy="true"] {
        cursor: progress;
      }
    }
  }
  pre{
    padding: 14px 1em;
    white-space-collapse: unset;
    code {
      // padding: 2em 1em;
      // margin: 0;
      pointer-events: all;
      // background-color: #f1f3f5;
      display: block;
    }
  }
  div{
    height: auto !important;
    code {
      padding: 2em 1em;
      margin: 0;
      pointer-events: all;
      // background-color: #f1f3f5;
      display: block;
    }
  }
  &.marknote-mermaid{
    pre{
      // visibility: hidden;
    }
  }
  .mermaid-render{
    display:flex;
    justify-content: center;
    padding-top: 2em;
  }
  
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
