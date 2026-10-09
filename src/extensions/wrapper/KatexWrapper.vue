<template>
  <NodeViewWrapper class="marknote-katex">
    <div v-show="isSelected()" class="katex-toolbar" contenteditable="false">
      <BlockSourceActions :source="source" :show-code="showCode" @update:show-code="toggleCode" />
    </div>
    <pre v-show="isSelected() && showCode" class="hljs block-source katex-source"><NodeViewContent as="code" /></pre>
    <button v-if="source.trim()" type="button" class="katex-content" contenteditable="false"
      @pointerdown.stop="preserveEditorFocus" @mousedown.stop="preserveEditorFocus" @focus="selectFormula(false)" @click.stop="selectFormula()" v-html="preview"></button>
    <button v-else type="button" class="katex-content katex-empty" contenteditable="false" :aria-label="t('mathBlock')"
      @pointerdown.stop="preserveEditorFocus" @mousedown.stop="preserveEditorFocus" @focus="selectFormula(false)" @click.stop="selectFormula()">{{ t('emptyFormula') }}</button>
  </NodeViewWrapper>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import katex from 'katex';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { useI18n } from 'vue-i18n';
import BlockSourceActions from './BlockSourceActions.vue';

const props = defineProps(nodeViewProps);
const { t } = useI18n();
const source = computed(() => props.node.textContent);
const showCode = ref(!source.value.trim());
watch(source, value => {
  if (!value.trim()) showCode.value = true;
});
const isSelected = () => {
  const pos = props.getPos();
  const anchor = props.editor.state.selection.anchor;
  return props.selected || (props.editor.isActive('katex') && anchor >= pos && anchor < pos + props.node.nodeSize);
};
const preserveEditorFocus = (event: Event) => {
  if (props.editor.isEditable) event.preventDefault();
};
const selectFormula = (focusEditor = true) => {
  const pos = props.getPos();
  if (!props.editor.isEditable) {
    // A stale native range can restore the previous block when its source hides.
    const selection = props.editor.view.dom.ownerDocument.getSelection();
    if (selection?.anchorNode && props.editor.view.dom.contains(selection.anchorNode)) selection.removeAllRanges();
    props.editor.commands.setNodeSelection(pos);
    return;
  }
  const chain = props.editor.chain();
  if (focusEditor) chain.focus();
  if (!source.value.trim() && props.editor.isEditable) chain.setTextSelection(pos + 1);
  else chain.setNodeSelection(pos);
  chain.run();
};
const toggleCode = async (value: boolean) => {
  showCode.value = value;
  if (!value || !props.editor.isEditable) return;
  await nextTick();
  const chain = props.editor.chain().focus();
  if (props.selected) chain.setTextSelection(props.getPos() + 1);
  chain.run();
};
const preview = computed(() => katex.renderToString(source.value, {
  throwOnError: false,
  displayMode: true,
  output: 'mathml',
}));
</script>

<style lang="scss">
.marknote-katex {
  position: relative;

  .katex-toolbar {
    position: absolute;
    top: 4px;
    right: 4px;
  }

  .katex-content {
    display: block;
    box-sizing: border-box;
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: inherit;
    padding: 2em .4em .4em;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      outline: 1px solid var(--contentBorderColor);
    }

    &:active {
      background: var(--contentBackgroundColorActive);
    }
  }

  .katex-empty {
    color: var(--editorEchoTextColor);
  }
}
</style>
