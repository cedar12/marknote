<template>
    <BubbleMenu v-if="props.editor" :editor="props.editor" :should-show="shouldShowTable">
      <button @click="props.editor.chain().focus().addColumnAfter().run()">增加列</button>
      <button @click="props.editor.chain().focus().deleteColumn().run()">删除列</button>
      <button @click="props.editor.chain().focus().addRowAfter().run()">增加行</button>
      <button @click="props.editor.chain().focus().deleteRow().run()">删除行</button>
      <button @click="props.editor.chain().focus().mergeOrSplit().run()">合并单元格</button>
      <button @click="props.editor.chain().focus().toggleHeaderRow().run()">表头</button>
    </BubbleMenu>
</template>

<script lang="ts" setup>
import {ShallowRef} from 'vue'
import { BubbleMenu, Editor } from '@tiptap/vue-3'

const props=defineProps<{
    editor:Editor,
}>();
const shouldShowTable= (props:any) => {
    return props.editor.isActive('table')
}
</script>