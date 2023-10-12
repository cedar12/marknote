<template>
  <el-popover v-model:visible="visible" size="small" placement="top" :offset="0" trigger="hover" :persistent="false"
    popper-class="link-popover-wrapper">
    <template #reference>
      <span :class="props.className">
        {{ `](${props.href})` }}
      </span>


    </template>
    <ElButtonGroup>
      <ElTooltip content="打开链接">

        <el-button size="small" @click="openLink">

          <a :href="props.href" :target="target()">
            <WebPage></WebPage>
          </a>

        </el-button>

      </ElTooltip>
      <ElTooltip content="编辑链接">
        <el-button size="small" :icon="Edit" @click="appWindow.emit('dialog-link-visible', props.href)" />
      </ElTooltip>
    </ElButtonGroup>
  </el-popover>
</template>
<script lang="ts" setup>
import { ElPopover, ElButton, ElButtonGroup, ElTooltip } from 'element-plus';
import { WebPage, Edit } from '@icon-park/vue-next';
import { Editor } from '@tiptap/vue-3';
import { ref } from 'vue';
import { appWindow } from '@tauri-apps/api/window';
import { useEditorStore } from '../../store/editor';

const editorStore=useEditorStore();

const visible = ref(false);

const props = defineProps<{ editor: Editor, className: string, href: string, start: number, end: number }>();

const value = ref(props.href);

appWindow.listen<string>('dialog-link-value', (event) => {
  value.value = event.payload;
  const { state, view } = props.editor;
  const from = props.start;
  const to = props.end;
  const text = state.doc.textBetween(from, to);
  // console.log(from, to, text, value.value);
  const schema = view.state.schema;
  const node = schema.text(text, [schema.marks.link.create({ href: value.value })]);

  view.dispatch(view.state.tr.deleteRange(from, to));
  view.dispatch(view.state.tr.insert(from, node));
  view.dispatch(view.state.tr.scrollIntoView());
})

const target = () => {
  if (props.href.startsWith('https://') || props.href.startsWith('http://')) {
    return '_blank';
  }
  return '';
}

const openLink=()=>{
  if(props.href.startsWith('#')){
    const id=editorStore.headings.find(h=>`#${h.text.toLocaleLowerCase().replace(/\s+/g,'-')}`==props.href);
    if(id){
      location.hash=id.id;
    }
  }
}


</script>
<style lang="scss">
.el-popover.link-popover-wrapper {
  --el-bg-color-overlay: transparent;
  --el-popover-padding: 0;
  min-width: auto !important;
  width: auto !important;
  box-shadow: none;
  border: none;

  a {
    color: inherit;
  }
}
</style>