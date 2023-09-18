<template>
    <div v-if="props.editor?.isActive('link')">
        <!-- {{ getLinkNode() }} -->
        <ElInput v-model="href" @change="onUpdate"></ElInput>
    </div>
</template>
<script  lang="ts" setup>
import {ElInput} from 'element-plus';
import {ref,watch} from 'vue';
// import {findMarkPosition} from '../../utils/mark';
import { Editor } from '@tiptap/vue-3';


const props=defineProps<{editor:Editor}>();

const href=ref('');

watch(()=>props.editor.state.selection,()=>{
    href.value=props.editor.state.selection.$from.marks()[0]?.attrs?.href;
})



const onUpdate=()=>{
    // const {state,view}=props.editor;
    // const {$from}=state.selection;
    console.log(href.value);
    props.editor.chain().focus().setLink({href:href.value})
    // props.editor.chain().focus().updateAttributes(state.schema.marks.link,{href:href.value});
    // state.tr.setNodeMarkup($from.pos,state.schema.marks.link,{href:href.value});
    // const tr=state.tr.setNodeAttribute($from.pos,'href',href.value);
    // view.dispatch(tr);
}

</script>