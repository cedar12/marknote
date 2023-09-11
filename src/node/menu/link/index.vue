<template>
    <div v-if="props.editor?.isActive('link')">
        {{ getLinkNode() }}
        <ElInput v-model="href" @change="onUpdate"></ElInput>
    </div>
</template>
<script  lang="ts" setup>
import {ElInput} from 'element-plus';
import {ref,watch} from 'vue';
import {findMarkPosition} from '../../utils/mark';
import { Editor } from '@tiptap/vue-3';


const props=defineProps<{editor:Editor}>();

const href=ref('');

watch(()=>props.editor.state.selection,()=>{
    href.value=props.editor.state.selection.$from.marks()[0]?.attrs?.href;
})

const getLinkNode=()=>{
    const {state}=props.editor;
    // @ts-ignore
    const {$anchor,from,to} = state.selection;
    // @ts-ignore
    const mark=findMarkPosition(state,state.config.schema.marks.link,from,to);
    // const mark=''
    console.log(state,mark,state.selection.$from.marks());
}

const onUpdate=(v:any)=>{
    console.log(v);
}

</script>