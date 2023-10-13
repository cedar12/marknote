<template>
  <el-popover  v-model:visible="visible"  size="small" placement="left" trigger="hover" :offset="6" :persistent="false" popper-class="table-cell-wrapper" >
      <template #reference>
        <a :class="props.className" @mousedown="onMouseDown"></a>
      </template>
      <div class="table-cell-tools" >
        <el-button  size="small" :icon="Up" @click="props.editor.chain().focus().addRowBefore().run()"/>
        <el-button  size="small" :icon="Delete" @click="()=>{hide();props.editor.chain().focus().deleteRow().run()}"/>
        <el-button  size="small" :icon="Down" @click="props.editor.chain().focus().addRowAfter().run()"/>
      </div>
  </el-popover>
</template>
<script lang="ts" setup>
import {ElPopover,ElButton} from 'element-plus';
import {Up,Down,Delete} from '@icon-park/vue-next';
import { Editor } from '@tiptap/vue-3';
import {  selectRow } from '../utils/table';
import {ref} from 'vue';

const visible=ref(false);

const props=defineProps<{editor:Editor,rowSelected:boolean,className:string,index:number}>();
const hide = () => {
  visible.value=false;
}


const onMouseDown=(event:MouseEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    if(props.rowSelected){
    }else{
      props.editor.view.dispatch(
        // @ts-ignore
        selectRow(props.index)(props.editor.state.tr)
      );
    }

};

</script>
<style lang="scss">
.el-popover.table-cell-wrapper{
  --el-bg-color-overlay:transparent;
  --el-popover-padding:0;
  min-width: auto !important;
  width: 36px !important;
  box-shadow: none;
  border: none;
  top: -1000px;
  left: -1000px;
  .table-cell-tools{
    display: flex;
    flex-direction: column;
    justify-content: left;
    .el-button{
      width: 100%;
      +.el-button{
        margin-top: -2px;
        border-top: none;
        margin: 0;
      }
    }
  }
}
</style>