<template>
  <NodeViewWrapper class="marknote-image">
    <div class="image-wrapper" contenteditable="false" v-show="isFocus">
        <div v-if="isEditable">
          <ElScrollbar>
          <span>![</span><AutoWidthInput ref="altRef" v-model:value="altValue" @change="setImageAlt"/><span>](</span><AutoWidthInput v-model:value="value" @blur="setImageSrc"/><span>)</span>
          </ElScrollbar>
        </div>
        <div v-else>
          <span>![</span>{{altValue}}<span>](</span>{{value}}<span>)</span>
        </div>
    </div>
    <el-image :src="imgSrc"  :alt="altValue" :title="props.node.attrs.title" referrerpolicy="origin-when-cross-origin">
      <template #error>
        <div class="image-slot">
          <el-icon><ImageFiles fill="#dfdfdf"/></el-icon>
        </div>
      </template>
    </el-image>
    <!-- <ElPopover trigger="click" placement="top" width="80%">
      
      <template #reference>
        <el-image :src="imgSrc"  :alt="alt" :title="title" referrerpolicy="origin-when-cross-origin">
          <template #error>
            <div class="image-slot">
              <el-icon><ImageFiles fill="#dfdfdf"/></el-icon>
            </div>
          </template>
        </el-image>
      </template>
      <div class="image-wrapper" >
        <div>
          <ElScrollbar>
          <span>![</span><AutoWidthInput v-model:value="altValue" @change="setImageAlt"/><span>](</span><AutoWidthInput v-model:value="value" @blur="setImageSrc"/><span>)</span>
          </ElScrollbar>
        </div>
      </div>
    </ElPopover> -->
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref,watch,nextTick,computed } from 'vue';
import {ImageFiles} from '@icon-park/vue-next';
import {ElImage,ElIcon,ElScrollbar} from 'element-plus';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
import {useAppStore} from '../../store/app';
import { useDraftsStore } from '../../store/drafts';
import { useEditorStore } from '../../store/editor';
import { resolveDocumentResource } from '../../utils/documentResources';
import AutoWidthInput from '../../components/input/AutoWidthInput.vue';
const appStroe=useAppStore();
const drafts=useDraftsStore();
const documentStore=useEditorStore();
const props = defineProps(nodeViewProps);
// ![图片](./vite.svg)
// @ts-ignore
const {  src, alt, title, width, height } = props.node.attrs;

const isEditable = ref(props.editor.isEditable);
const value = ref(src || '');
const altValue=ref(alt||'');

const altRef=ref();

const imgSrc=ref('');
watch([()=>value.value,()=>appStroe.filepath,()=>drafts.resourceSourcePath,()=>documentStore.attachmentMapping],()=>{
  try { imgSrc.value=value.value ? resolveDocumentResource(value.value,appStroe.filepath||drafts.resourceSourcePath,documentStore.attachmentMapping) : ''; }
  catch { imgSrc.value=''; }
},{immediate:true});

const isFocus=computed(()=>{
  const {anchor}=props.editor.state.selection;
  const node=props.node;
  const pos=props.getPos();
  //console.log(anchor,pos,node.nodeSize,node);
  const is=props.editor.isActive('image')&&anchor == pos &&anchor <= pos + node.nodeSize-1;
  //&&(anchor == pos && anchor <= pos + node.nodeSize )
  // console.log(node,pos,anchor);
  
  
  return is;
})
watch(()=>props.node.attrs.src, source=>{value.value=source||'';});
watch(()=>props.node.attrs.alt, text=>{altValue.value=text||'';});

watch(()=>isFocus.value,focused=>{
  if(!focused)return;
  nextTick(()=>{
    altRef.value?.focus();
  })
})
/*
const isFocus=()=>{
  
  const {anchor}=props.editor.state.selection;
  const node=props.node;
  const pos=props.getPos();
  //console.log(anchor,pos,node.nodeSize,node);
  const is=props.editor.isActive('image')&&anchor == pos &&anchor <= pos + node.nodeSize-1;
  //&&(anchor == pos && anchor <= pos + node.nodeSize )
  // console.log(node,pos,anchor);
  nextTick(()=>{
    console.log(altRef.value);
    altRef.value.focus();
  })
  
  return is;
}*/

//const srcList=ref([imgSrc.value]);

const setImageSrc=()=>{
  props.updateAttributes({src:value.value});
}
const setImageAlt=()=>{
  props.updateAttributes({alt:altValue.value});
}

</script>

<style lang="scss">
.marknote-image {
  position: relative;
  display: inline-block;
  user-select: all;
  // padding: 0 .2em;
  img{
    min-width: 30px;
    min-height: 30px;
  }
  .el-icon{
    font-size: 1em;
  }
}
</style>
