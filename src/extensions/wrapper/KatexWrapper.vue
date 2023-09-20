<template>
  <NodeViewWrapper class="marknote-katex" >
    <div class="katex-wrapper" contenteditable="false" v-if="isFocus()">
      <ElInput v-model="value" autosize ref="inputRef"
    type="textarea"  @change="onChangeText" @keydown:enter="onEnter"></ElInput>
    </div>
    <div className="katex-content" v-if="value&&value.trim()!=''" v-html="formatText()"></div>
    <div className="katex-content" v-else>
      <span class="katex-empty">未输入公式</span>
    </div>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref,onMounted,watch,nextTick } from 'vue';
import {ElInput} from 'element-plus';
import katex from 'katex';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
const props = defineProps(nodeViewProps);
const {  text } = props.node.attrs;

const value=ref(text);
const inputRef=ref();

watch(()=>text.value,()=>{
  console.log('text watch',text);
  value.value=text.value;
});

onMounted(()=>{
  console.log('katex',text);

})

const isFocus=()=>{
  
  const {anchor}=props.editor.state.selection;
  const node=props.node;
  const pos=props.getPos();
  const is=props.editor.isActive('katex')&&(anchor >= pos && anchor <= pos + node.nodeSize - 1);
  if(is&&inputRef.value){
    nextTick(()=>{
      inputRef.value.focus();
    });
    
  }
  return is;
}
const onChangeText=()=>{
  // const rr=katex.renderToString(`${value.value}`);
  // console.log('katex change text',value.value,rr);
  
  props.updateAttributes({ text: value.value });
}
const formatText = ():string => {
    try {
      return katex.renderToString(`${value.value}`);
      // error.value=null;
      // return result;
    } catch (e) {
      // error.value=e;
      return `<span class="katex-error">${e}</span>`;
    }
};


const onEnter=(event:KeyboardEvent)=>{
  console.log(event);
  if(event.ctrlKey||event.altKey||event.metaKey){
    props.editor.chain().focus().enter().run();
  }
}

</script>

<style lang="scss">
.marknote-katex {
  position: relative;
  textarea{
    background-color: #d6d4d4;
    outline: none;
  }
  .katex-error{
    color: #f00;
  }
  .katex-html{
      display: none;
  }
}
</style>