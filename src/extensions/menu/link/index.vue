<template>
    <BubbleMenu :editor="editor">
        <div v-if="editor?.isActive('link')">
            <!-- {{ getLinkNode() }} -->
            <ElInput v-model="href" @change="onUpdate"></ElInput>
            <!-- <ElButton @click="()=>editor.chain().focus().toggleLink({href:''})">链接</ElButton> -->
        </div>
    </BubbleMenu>
</template>
<script  lang="ts" setup>
import {BubbleMenu} from '@tiptap/vue-3';
import {ElInput} from 'element-plus';
import {ref,reactive,watch} from 'vue';
import {findMarkPosition} from '../../utils/mark';
import { Editor } from '@tiptap/vue-3';
import {useEditorStore} from '../../../store/editor';
import {storeToRefs} from 'pinia';

const editorStore=useEditorStore();
const {editor}=storeToRefs(editorStore);
const props=defineProps<{editor:Editor}>();

const href  = ref('');

const values=reactive({
    text:'',
    from:-1,
    to:-1,
});

watch(()=>editor.value.state.selection,()=>{
    
    const { state } = editor.value;
    const { $head, from, to } = editor.value.state.selection;
    state.doc.nodesBetween(from,to,(node)=>{
        // console.log('between',node);
        const marks=node.marks;
        if(marks.length>0){
            href.value=marks[0]?.attrs?.href;
        }
        
    });
    const marks = $head.marks();
    // console.log('marks',marks);
    // href.value=marks[0]?.attrs?.href;
    let start;
    let end;

    if (marks.length) {
        const mark = marks[0];
        const node = $head.node($head.depth);
        const startPosOfThisLine = $head.pos - (($head.nodeBefore && $head.nodeBefore.nodeSize) || 0);
        const endPosOfThisLine = $head.nodeAfter
            ? startPosOfThisLine + $head.nodeAfter.nodeSize
            : $head.pos - $head.parentOffset + node.content.size;

        const { start: startPos, end: endPos } = findMarkPosition(state, mark, startPosOfThisLine, endPosOfThisLine);
        start = startPos;
        end = endPos;
    } else {
        start = from;
        end = to;
    }

    const text = state.doc.textBetween(start, end);
    values.text=text;
    values.from=start;
    values.to=end;
})


const onUpdate=()=>{
    const {state,view}=props.editor;
    // const {from,to}=state.selection;
    const from=values.from;
    const to=values.to;
    console.log(href.value);
    const text = state.doc.textBetween(from,to);
     const schema = view.state.schema;
     const node = schema.text(text, [schema.marks.link.create({ href: href.value})]);

    view.dispatch(view.state.tr.deleteRange(from, to));
    view.dispatch(view.state.tr.insert(from, node));
    view.dispatch(view.state.tr.scrollIntoView());
    // editor.value.chain().focus().setLink({href:href.value})
    // props.editor.chain().focus().updateAttributes(state.schema.marks.link,{href:href.value});
    // state.tr.setNodeMarkup($from.pos,state.schema.marks.link,{href:href.value});
    // const tr=state.tr.setNodeAttribute($from.pos,'href',href.value);
    // view.dispatch(tr);
}

</script>