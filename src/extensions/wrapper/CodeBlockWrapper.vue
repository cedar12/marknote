<template>
  <NodeViewWrapper class="marknote-codeblock" :class="{'marknote-mermaid':isMermaid()}" ref="wrapperRef">
    <!-- <div class="codeblock-wrapper" contenteditable="false" v-if="props.editor.isActive('codeBlock')&&isFocus()"> -->
    <div class="codeblock-wrapper" contenteditable="false" >
      <ElSelect clearable filterable size="small" v-model="value" placeholder=" " :style="{width:value==''?'40px':'110px'}"
        :disabled="!isEditable" @change="props.updateAttributes({ language: value })">
        <ElOption v-for="item in options()" :key="item" :label="item" :value="item"></ElOption>
      </ElSelect>
      <div>
        <ElTooltip size="small " :content="t('code')" v-if="isMermaid()">
          <ElButton size="small" @click="showCode=!showCode" tabindex="-1">
              <Code></Code>
          </ElButton>
        </ElTooltip>
        <ElTooltip size="small " :content="t('copy')">
          <ElButton size="small" @click="handleClick" tabindex="-1">
              <Copy></Copy>
          </ElButton>
        </ElTooltip>
        
      </div>
    </div>
    <pre ref="contentRef" class="hljs" v-show="!isMermaid()||showCode">
      <NodeViewContent as="code"></NodeViewContent>
    </pre>
    <div v-if="isMermaid()" class="mermaid-render" v-html="mermaidValue" contenteditable="false" ></div>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref,onMounted,watch,getCurrentInstance  } from 'vue';
import {ElSelect,ElOption,ElButton,ElTooltip} from 'element-plus';
import { Copy,Code } from '@icon-park/vue-next';
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

const contentRef=ref<HTMLElement>();
const wrapperRef=ref<HTMLElement>();

const mermaidValue=ref<string>();

const isMermaid=()=>{
  return props.node.attrs.language==='mermaid';
}

const options=()=>{
  const list=props.extension.options.lowlight.listLanguages();

  return [...list,'mermaid'];
}



const handleClick=()=>{
  
  const text=(contentRef.value?.children[0] as HTMLElement).innerText;
  console.log('copy',text);
  if(text)
  writeText(text);
}

const renderMermaid=async ()=>{
  if(props.node.attrs.language==='mermaid'&&instance){
    const svg = await mermaid.render('mermaid_'+instance.uid,props.node.textContent);
    mermaidValue.value=svg.svg;
  }
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

  .codeblock-wrapper {
    display: flex;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 4px 0 4px;
    position: absolute;
    top: 0;
    .el-select {
      width: 110px;
      --el-select-border-color-hover: #ffffff00;
      --el-select-input-focus-border-color: #ffffff00;
    }
    .el-input__wrapper{
      background-color: transparent;
      box-shadow: none;
    }
    .el-button{
      background-color: transparent;
    }
  }
  pre{
    padding: 2em 1em;
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