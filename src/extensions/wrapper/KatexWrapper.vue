<template>
  <NodeViewWrapper class="marknote-katex">
    <pre v-show="isSelected()" class="katex-source"><NodeViewContent as="code" /></pre>
    <div v-if="source.trim()" class="katex-content" contenteditable="false" v-html="preview"></div>
    <div v-else class="katex-content katex-empty" contenteditable="false">{{ t('emptyFormula') }}</div>
  </NodeViewWrapper>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import katex from 'katex';
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { useI18n } from 'vue-i18n';

const props = defineProps(nodeViewProps);
const { t } = useI18n();
const source = computed(() => props.node.textContent);
const isSelected = () => {
  const pos = props.getPos();
  const anchor = props.editor.state.selection.anchor;
  return props.selected || (props.editor.isActive('katex') && anchor >= pos && anchor < pos + props.node.nodeSize);
};
const preview = computed(() => katex.renderToString(source.value, {
  throwOnError: false,
  displayMode: true,
}));
</script>

<style lang="scss">
.marknote-katex {
  .katex-source {
    box-sizing: border-box;
    margin: 0;
    padding: 1em;
    border: 1px solid var(--contentBorderColor);
    border-radius: 4px;
    background: var(--editorHighlightBackgroundColor);
    color: var(--editorHighlightTextColor);
    font-family: JetBrainsMono, ui-monospace, monospace;
    white-space: pre-wrap;
    tab-size: var(--tabSize, 4);

    code {
      display: block;
      min-height: 1.2em;
      outline: none;
      font: inherit;
      white-space: inherit;
    }
  }

  .katex-content {
    padding: .4em;
  }

  .katex-empty {
    color: var(--editorEchoTextColor);
  }
}
</style>
