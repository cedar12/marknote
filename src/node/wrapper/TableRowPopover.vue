<template>
  <el-popover v-model:visible="visible"  size="small" placement="top" trigger="hover" :persistent="false" popper-class="table-row-wrapper" >
      <template #reference>
        <a :class="props.className" @mousedown="onMouseDown"></a>
      </template>
      <div class="table-row-tools" >
        <el-button  size="small" :icon="Left" @click="props.editor.chain().focus().addColumnBefore().run()"/>
        <el-button  size="small" :icon="Delete" @click="()=>{hide();props.editor.chain().focus().deleteColumn().run()}"/>
        <el-button  size="small" :icon="Right" @click="props.editor.chain().focus().addColumnAfter().run()"/>
      </div>
  </el-popover>
</template>
<script lang="ts" setup>
import {ElPopover,ElButton} from 'element-plus';
import {Left,Right,Delete} from '@icon-park/vue-next';
import { Editor } from '@tiptap/vue-3';
import {  selectColumn } from '../utils/table';
import {ref} from 'vue';

const visible=ref(false);

const props=defineProps<{editor:Editor,className:string,index:number}>();

const hide = () => {
  visible.value=false;
}

const onMouseDown=(event:MouseEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    props.editor.view.dispatch(
      // @ts-ignore
      selectColumn(props.index)(props.editor.state.tr)
    );

};

</script>
<style lang="scss">
.el-popover.table-row-wrapper{
  --el-bg-color-overlay:transparent;
  --el-popover-padding:0;
  min-width: auto !important;
  width: calc(36px * 3) !important;
  box-shadow: none;
  border: none;
  top: -1000px;
  left: -1000px;
  .table-row-tools{
    display: flex;
    flex: 1 1 1;
    .el-button{
      margin: 0;
      +.el-button{
        // margin-left: -2px;
        border-left: none;
      }
    }
  }
}
</style>