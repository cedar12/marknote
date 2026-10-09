<template>
  <NodeViewWrapper class="marknote-codeblock" :class="{'marknote-mermaid':isMermaid()}" ref="wrapperRef">
    <div class="codeblock-wrapper" contenteditable="false" v-show="isFocus()">
      <ElSelect class="left-wrapper" clearable filterable size="small" v-model="value" placeholder="    " 
        :disabled="!isEditable" @change="props.updateAttributes({ language: value })">
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



const instance=getCurrentInstance();
const props = defineProps(nodeViewProps);

const isEditable = ref(props.editor.isEditable);
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
  .codeblock-wrapper {
    display: flex;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 4px 0 4px;
    position: absolute;
    top: 0;
    height:0px;
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
  }
  div{
    height: auto !important;
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
