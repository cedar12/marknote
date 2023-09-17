<template>
    <div class="marknote-outliner" v-if="editorStore.editor">
        <!-- <button @click="handleClick">log</button> -->
        <div class="outliner-tree">
            <ElScrollbar height="100%">
                <ElTree
                    :data="editorStore.tree"
                    selectable
                    @node-click="onSelected"
                    node-key="value"
                    empty-text=""
                />
            </ElScrollbar>
        </div>
    </div>
</template>
<script lang="ts" setup>
import {useEditorStore} from '../store/editor';
import {ElTree,ElScrollbar} from 'element-plus';
// import {Right} from '@icon-park/vue-next';

const editorStore=useEditorStore();


const onSelected=(node:any)=>{
    console.log(node);
    if(node.label!=''){
        location.hash=node.value;
    }
    
}


</script>
<style lang="scss">
.marknote-outliner{
    background-color: var(--primaryBackgroundColor);
    color: var(--primaryTextColor);
    padding-top: var(--titleBarHeight);
    --el-fill-color-light: var(--primaryBackgroundColorHover);
    --el-fill-color-blank: var(--primaryBackgroundColor);
    --el-text-color-regular: var(--primaryTextColor);
    .outliner-tree{
        height: calc(100vh - var(--titleBarHeight));
        overflow: hidden;
    }
}
</style>