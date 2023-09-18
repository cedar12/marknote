<template>
  <NodeViewWrapper class="marknote-image" >
    <ElPopover trigger="hover" placement="top">
      
      <template #reference>
        <el-image :src="imgSrc" :preview-src-list="srcList" :width="width" :height="height" :alt="alt" :title="title">
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
import { convertFileSrc } from '@tauri-apps/api/tauri';
const props = defineProps(nodeViewProps);
// ![图片](./vite.svg)
const {  src, alt, title, width, height } = props.node.attrs;

const isEditable = ref(props.editor.isEditable);
const value = ref(src || '');

const imgSrc=ref('');
watch(()=>value.value,()=>{
  if(value.value.startsWith('http')){
    imgSrc.value=value.value;
  }else{
    imgSrc.value=convertFileSrc(value.value);
  }
  srcList.value[0]=imgSrc.value;
})

const srcList=ref([imgSrc.value]);

const setImageSrc=()=>{
  props.updateAttributes({src:value.value});
}

onMounted(()=>{
  if(value.value.startsWith('http')){
    imgSrc.value=value.value;
  }else{
    imgSrc.value=convertFileSrc(value.value);
  }
  srcList.value[0]=imgSrc.value;
})
</script>

<style lang="scss">
.marknote-image {
  position: relative;
  img{
    min-width: 30px;
    min-height: 30px;
  }
  .el-icon{
    font-size: 1em;
  }
}
</style>