<template>
  <NodeViewWrapper class="marknote-image">
    <ElPopover trigger="hover" placement="top">
      
      <template #reference>
        <el-image :src="imgSrc" :width="width" :height="height" :alt="alt" :title="title">
          <template #error>
            <div class="image-slot">
              <el-icon><ImageFiles fill="#dfdfdf"/></el-icon>
            </div>
          </template>
        </el-image>
        <!-- <img :src="src" :alt="alt" :title="title" /> -->
      </template>
      <div class="image-wrapper" >
        <ElInput v-model="value" :disabled="!isEditable" @blur="setImageSrc"></ElInput>
      </div>
    </ElPopover>
  </NodeViewWrapper>
</template>
<script lang="ts" setup>
import { ref,onMounted,watch } from 'vue';
import {ImageFiles} from '@icon-park/vue-next';
import {ElInput,ElPopover,ElImage,ElIcon} from 'element-plus';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
import { convertFileSrc } from '@tauri-apps/api/primitives';
import {useAppStore} from '../../store/app';
const appStroe=useAppStore();
const props = defineProps(nodeViewProps);
// ![图片](./vite.svg)
const {  src, alt, title, width, height } = props.node.attrs;

const isEditable = ref(props.editor.isEditable);
const value = ref(src || '');

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

//const srcList=ref([imgSrc.value]);

const setImageSrc=()=>{
  props.updateAttributes({src:value.value});
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