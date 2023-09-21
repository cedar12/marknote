<template>
  <NodeViewWrapper class="marknote-katex" >
    <div class="katex-wrapper" contenteditable="false" v-if="isFocus()">
      <!-- <ElInput v-model="value" autosize ref="inputRef"
    type="textarea"  @change="onChangeText" @keydown="onKeydown"></ElInput> -->
      
      <ElTooltip size="small " :content="t('edit')">
          <ElButton size="small" :icon="Edit" @click="onEdit"></ElButton>
      </ElTooltip>
    </div>
    <div className="katex-content" v-if="value&&value.trim()!=''" v-html="formatText()"></div>
    <div className="katex-content" v-else>
      <span class="katex-empty">未输入公式</span>
    </div>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import {Edit} from '@icon-park/vue-next';
import { ref,onMounted,watch,nextTick } from 'vue';
import {ElButton,ElTooltip} from 'element-plus';
import katex from 'katex';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
import { appWindow } from '@tauri-apps/api/window';
import {useI18n} from 'vue-i18n';
const props = defineProps(nodeViewProps);
const {  text } = props.node.attrs;

const {t}=useI18n();

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

appWindow.listen<string>('dialog-katex-text',(event)=>{
  value.value=event.payload;
  onChangeText();
})

const onEdit=()=>{
  appWindow.emit('dialog-katex-visible',value.value);
}
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
.marknote-katex {
  position: relative;
  .katex-wrapper{
    display: flex;
    justify-content: end;
  }
  .katex-html{
      display: none;
  }
}
</style>