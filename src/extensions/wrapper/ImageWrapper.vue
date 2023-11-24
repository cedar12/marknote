<template>
  <NodeViewWrapper class="marknote-image">
    <div class="image-wrapper" contenteditable="false" v-show="isFocus()">
        <div v-if="isEditable">
          <ElScrollbar>
          <span>![</span><AutoWidthInput v-model:value="altValue" @change="setImageAlt"/><span>](</span><AutoWidthInput v-model:value="value" @blur="setImageSrc"/><span>)</span>
          </ElScrollbar>
        </div>
        <div v-else>
          <span>![</span>{{altValue}}<span>](</span>{{value}}<span>)</span>
        </div>
    </div>
    <el-image :src="imgSrc"  :alt="alt" :title="title" referrerpolicy="origin-when-cross-origin">
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
import { ref,onMounted,watch } from 'vue';
import {ImageFiles} from '@icon-park/vue-next';
import {ElImage,ElIcon,ElScrollbar} from 'element-plus';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
import { convertFileSrc } from '@tauri-apps/api/primitives';
import {useAppStore} from '../../store/app';
import AutoWidthInput from '../../components/input/AutoWidthInput.vue';
const appStroe=useAppStore();
const props = defineProps(nodeViewProps);
// ![图片](./vite.svg)
// @ts-ignore
const {  src, alt, title, width, height } = props.node.attrs;

const isEditable = ref(props.editor.isEditable);
const value = ref(src || '');
const altValue=ref(alt||'');

const imgSrc=ref('');
watch(()=>value.value,()=>{
  if(value.value.startsWith('http://')||value.value.startsWith('https://')){
    imgSrc.value=value.value;
  }else{
    // 相对markdown文件路径待优化

    imgSrc.value=convertFileSrc(value.value);
  }
  // srcList.value[0]=imgSrc.value;
})

const isFocus=()=>{
  
  const {anchor}=props.editor.state.selection;
  const node=props.node;
  const pos=props.getPos();
  //console.log(anchor,pos,node.nodeSize,node);
  const is=props.editor.isActive('image')&&anchor == pos &&anchor <= pos + node.nodeSize-1;
  //&&(anchor == pos && anchor <= pos + node.nodeSize )
  // console.log(node,pos,anchor);
  return is;
}

//const srcList=ref([imgSrc.value]);

const setImageSrc=()=>{
  props.updateAttributes({src:value.value});
}
const setImageAlt=()=>{
  props.updateAttributes({alt:altValue.value});
}

const isAbsolute=(path:string)=>{
  if(path.startsWith('/')){
    return true;
  }
  if(/^[a-zA-Z]:(\\|\/)/.test(path)){
    return true;
  }
  return false;
}

const getDir=(path:string)=>{
  var index=path.lastIndexOf('/');
  if(index==-1){
    var index=path.lastIndexOf('\\');
  }
  return path.substring(0,index+1);
}

onMounted(()=>{
  if(value.value.startsWith('http')){
    imgSrc.value=value.value;
  }else if(isAbsolute(value.value)){
    imgSrc.value=convertFileSrc(value.value);
  }else if(appStroe.filepath){
    const dir=getDir(appStroe.filepath);
    console.log(dir+value.value,convertFileSrc);
    imgSrc.value=convertFileSrc(dir+value.value);
  }

  console.log(alt,altValue.value);
  // srcList.value[0]=imgSrc.value;
})
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