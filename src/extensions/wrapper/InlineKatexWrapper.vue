<template>
  <NodeViewWrapper class="marknote-inline-katex" >
    <div class="katex-input-wrapper" contenteditable="false" v-show="isFocus()">
      <span class="mark-wrapper">$</span>
      <!-- <input v-model="value" ref="inputRef" type="text"  @change="onChangeText" @keydown="onkeyDown" /> -->
      <AutoWidthInput v-model:value="value"  @change="onChangeText" @keydown="onkeyDown" />
      
      <span class="mark-wrapper">$</span>
    </div>
    <div className="katex-content" v-show="!isFocus()&&value&&value.trim()!=''" v-html="formatText()"></div>
    <!-- <div className="katex-content" v-else>
      <span class="katex-empty">未输入公式</span>
    </div> -->
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
// import {Edit} from '@icon-park/vue-next';
import AutoWidthInput from '../../components/input/AutoWidthInput.vue';
import { ref,onMounted,watch } from 'vue';
import katex from 'katex';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
// import {useI18n} from 'vue-i18n';

const props = defineProps(nodeViewProps);
const {  text } = props.node.attrs;

// const {t}=useI18n();

const value=ref(text);
// const inputRef=ref<HTMLElement>();

watch(()=>text.value,()=>{
  console.log('text watch',text);
  value.value=text.value;
});

onMounted(()=>{
  console.log('katex',text);
  
});

const isFocus=()=>{
  
  const {anchor}=props.editor.state.selection;
  const node=props.node;
  const pos=props.getPos();
  //console.log(anchor,pos,node.nodeSize,node);
  const is=props.editor.isActive('inlineKatex')&&(anchor == pos && anchor <= pos + node.nodeSize - 1);
  /*
  if(is&&inputRef.value){
    nextTick(()=>{
      inputRef.value.focus();
    });
    
  }*/
  return is;
}
const onChangeText=()=>{
  // const rr=katex.renderToString(`${value.value}`);
  // console.log('katex change text',value.value,rr);
  
  props.updateAttributes({ text: value.value });
}

const onkeyDown=(e:KeyboardEvent|Event)=>{
  // console.log(e);
  if(e instanceof KeyboardEvent&&e.key==='Backspace'&&value.value===''){
    props.editor.commands.deleteSelection();
  }
}
// const onEdit=()=>{
//   appWindow.emit('dialog-katex-visible',value.value);
// }
const formatText = ():string => {
  return katex.renderToString(`${value.value}`,{throwOnError:false,displayMode:true});
    // try {
    //   return katex.renderToString(`${value.value}`,{throwOnError:false,displayMode:true});
    //   // error.value=null;
    //   // return result;
    // } catch (e) {
    //   // error.value=e;
    //   return `<span class="katex-error">${e}</span>`;
    // }
};

</script>

<style lang="scss">
.marknote-inline-katex {
  position: relative;
  display:inline-block;
  padding: 0 0.1em;
  box-sizing: border-box;
  .katex-input-wrapper{
    box-sizing: border-box;
    //display: flex;
    //justify-content: end;
    //display: none;
    // outline: none;
    // background-color: var(--contentBackgroundColorActive);
    // color: var(--contentColorActive);
    width: auto;
    
    
  }
  .katex-html{
      display: none;
  }
}
</style>