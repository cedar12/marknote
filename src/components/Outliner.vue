<template>
    <div class="marknote-outliner" v-if="editorStore.editor">
        <button @click="handleClick">log</button>
        <n-tree
            block-line
            :data="editorStore.tree"
            :default-expanded-keys="[]"
            key-field="label"
            label-field="label"
            children-field="children"
            selectable
            :on-update:selected-keys="onSelected"
        />
    </div>
</template>
<script lang="ts" setup>
import {useEditorStore} from '../store/editor2';
import {NTree,TreeOption} from 'naive-ui';
// import {Right} from '@icon-park/vue-next';

const editorStore=useEditorStore();


const handleClick=()=>{
    const tree=editorStore.tree;
    console.log(tree);
}

const onSelected=(keys:string[])=>{
    console.log(keys);
    if(keys[0]!=''){
        location.hash=keys[0];
    }
    
}


</script>
<style lang="scss">
.marknote-outliner{
    padding-top: var(--titleBarHeight);
}
</style>