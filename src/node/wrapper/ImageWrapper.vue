<template>
  <NodeViewWrapper class="marknote-image" >
    <ElPopover trigger="hover" placement="top">
      
      <template #reference>
        <el-image :src="value" :preview-src-list="srcList" :width="width" :height="height" :alt="alt" :title="title">
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
import { ref,onMounted } from 'vue';
import {ImageFiles} from '@icon-park/vue-next';
import {ElInput,ElPopover,ElImage,ElIcon} from 'element-plus';
import { NodeViewWrapper, nodeViewProps} from '@tiptap/vue-3';
const props = defineProps(nodeViewProps);
// ![图片](./vite.svg)
const { hasTrigger, error, src, alt, title, width, height, textAlign } = props.node.attrs;

const isEditable = ref(props.editor.isEditable);
const value = ref(src || '');

const srcList=[value.value];

const setImageSrc=()=>{
  props.updateAttributes({src:value.value});
}

onMounted(()=>{
  console.log('image',props,hasTrigger,error,textAlign);
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