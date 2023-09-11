<template>
    <div class="marknote-outliner" v-if="editorStore.editor">
        <button @click="handleClick">log</button>
        <ElTree
            :data="editorStore.tree"
            selectable
            @node-click="onSelected"
            node-key="value"
            empty-text=""
        />
    </div>
</template>
<script lang="ts" setup>
import {useEditorStore} from '../store/editor2';
import {ElTree} from 'element-plus';
// import {Right} from '@icon-park/vue-next';

const editorStore=useEditorStore();


const handleClick=()=>{
    const tree=editorStore.tree;
    console.log(tree);
}

const onSelected=(node:any)=>{
    console.log(node);
    if(node.label!=''){
        location.hash=node.value;
    }
    
}


</script>
<style lang="scss">
.marknote-outliner{
    padding-top: var(--titleBarHeight);
}
</style>