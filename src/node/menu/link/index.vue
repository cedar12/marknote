<template>
    <div v-if="props.editor?.isActive('link')">
        {{ getLinkNode() }}
        <NInput v-model:value="href" :on-update:value="onUpdate"></NInput>
    </div>
</template>
<script  lang="ts" setup>
import {NInput} from 'naive-ui';
import {ref,watch} from 'vue';
import {findMarkPosition} from '../../utils/mark';


const props=defineProps<{editor:Editor}>();

const href=ref('');

watch(()=>props.editor.state.selection,()=>{
    href.value=props.editor.state.selection.$from.marks()[0]?.attrs?.href;
})

const getLinkNode=()=>{
    const {state}=props.editor;
    const {$anchor,from,to} = state.selection;
    const mark=findMarkPosition(state,state.config.schema.marks.link,from,to);
    // const mark=''
    console.log(state,mark,state.selection.$from.marks());
}

const onUpdate=(v:any)=>{
    console.log(v);
}

</script>