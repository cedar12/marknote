<template>
  <ElConfigProvider :locale="elLocale">
    <ElDialog
      class="file-comparison-dialog"
      data-shortcut-capture
      aria-describedby="file-comparison-hint"
      :model-value="comparison.visible"
      :title="t('fileComparisonTitle')"
      width="900px"
      top="6vh"
      :z-index="100100"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="true"
      :before-close="beforeClose"
      @update:model-value="value => { if (!value) comparison.close(); }"
      @opened="focusSafeAction"
      @closed="restoreFocus"
    >
      <p id="file-comparison-hint" class="file-comparison-hint">{{ t('fileComparisonHint') }}</p>
      <p class="file-comparison-path">{{ comparison.path }}</p>
      <div class="file-comparison-status" aria-live="polite" :role="comparison.errorKey ? 'alert' : 'status'">
        <p v-if="comparison.pending">{{ t('fileComparisonWorking') }}</p>
        <p v-else-if="comparison.errorKey">{{ t(comparison.errorKey) }}</p>
        <p v-else-if="comparison.stale">{{ t('fileComparisonStale') }}</p>
        <p v-else-if="comparison.result">
          {{ t(comparison.result.complete ? 'fileComparisonCounts' : 'fileComparisonPartialCounts', {
            removed: formatNumber(comparison.result.removed), added: formatNumber(comparison.result.added),
          }) }}
        </p>
      </div>
      <template v-if="comparison.result">
        <p v-if="!comparison.result.complete" class="file-comparison-limit">{{ t('fileComparisonPartial') }}</p>
        <p v-if="comparison.result.hiddenRows" class="file-comparison-limit">
          {{ t('fileComparisonDisplayLimited', { count: formatNumber(comparison.result.hiddenRows) }) }}
        </p>
        <p v-else-if="comparison.result.shortenedLines" class="file-comparison-limit">{{ t('fileComparisonShortened') }}</p>
        <p v-if="comparison.result.complete && !comparison.result.removed && !comparison.result.added" class="file-comparison-empty">
          {{ t('fileComparisonIdentical') }}
        </p>
        <div v-else class="file-comparison-scroll" tabindex="0" :aria-label="t('fileComparisonTitle')"
          :aria-busy="comparison.pending" aria-describedby="file-comparison-hint" :class="{ 'is-stale': comparison.stale || comparison.pending }">
          <table class="file-comparison-table">
            <thead>
              <tr><th scope="col">{{ t('fileComparisonLocal') }}</th><th scope="col">{{ t('fileComparisonDisk') }}</th><th scope="col" :aria-label="t('fileComparisonTitle')"><span aria-hidden="true">− / +</span></th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in comparison.result.rows" :key="index" :class="'diff-' + row.kind">
                <td v-if="row.kind === 'skip'" colspan="3" class="file-comparison-skip">{{ skipLabel(row) }}</td>
                <template v-else>
                  <td class="file-comparison-number">{{ row.localLine === null ? '' : formatNumber(row.localLine) }}</td>
                  <td class="file-comparison-number">{{ row.diskLine === null ? '' : formatNumber(row.diskLine) }}</td>
                  <td class="file-comparison-code">
                    <span class="file-comparison-symbol">{{ row.kind === 'remove' ? '−' : row.kind === 'add' ? '+' : ' ' }}</span>
                    <span class="file-comparison-text">{{ row.text || ' ' }}</span>
                    <span v-if="row.kind !== 'equal'" class="file-comparison-ending">{{ row.ending === 'EOF' ? t('fileComparisonNoNewline') : row.ending }}</span>
                    <span v-if="row.shortened" class="file-comparison-ending">{{ t('fileComparisonShortened') }}</span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div v-else class="file-comparison-placeholder" :aria-busy="comparison.pending"></div>
      <template #footer>
        <div class="file-comparison-actions">
          <ElButton ref="closeRef" @click="comparison.close()">{{ t('fileComparisonClose') }}</ElButton>
          <ElButton :disabled="comparison.pending" @click="comparison.refresh()">
            {{ t(comparison.errorKey ? 'retry' : 'fileComparisonRefresh') }}
          </ElButton>
        </div>
      </template>
    </ElDialog>
  </ElConfigProvider>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElButton, ElConfigProvider, ElDialog } from 'element-plus';
import en from 'element-plus/es/locale/lang/en';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { useFileComparisonStore } from '../../store/fileComparison';
import { useEditorStore } from '../../store/editor';
import type { TextDiffRow } from '../../utils/textDiff';

const { t, locale } = useI18n();
const comparison = useFileComparisonStore();
const editor = useEditorStore();
const closeRef = ref<InstanceType<typeof ElButton>>();
const elLocale = computed(() => locale.value === 'zhCn' ? zhCn : en);
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value === 'zhCn' ? 'zh-CN' : 'en').format(value);
function skipLabel(row: Extract<TextDiffRow, { kind: 'skip' }>): string {
  if (row.reason === 'input') return t('fileComparisonInputLimit');
  if (row.reason === 'work') return t('fileComparisonUncompared', { local: formatNumber(row.localCount), disk: formatNumber(row.diskCount) });
  return t(row.reason === 'equal' ? 'fileComparisonLinesSkipped' : 'fileComparisonDisplayLimited', { count: formatNumber(row.count) });
}
function focusSafeAction() { closeRef.value?.$el.focus(); }
function beforeClose(done: () => void) { comparison.close(); done(); }
async function restoreFocus() {
  await nextTick();
  if (!comparison.visible) editor.focus();
}
</script>

<style lang="scss">
.file-comparison-dialog {
  --el-dialog-bg-color: var(--contentBackgroundColor);
  --el-bg-color: var(--contentBackgroundColor);
  --el-bg-color-overlay: var(--contentBackgroundColor);
  --el-fill-color-blank: var(--contentBackgroundColor);
  --el-fill-color-light: var(--contentBackgroundColorActive);
  --el-text-color-primary: var(--contentTextColor);
  --el-text-color-regular: var(--contentTextColor);
  --el-border-color: var(--contentBorderColor);
  --el-border-color-light: var(--contentBorderColor);
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 6vh - 24px);
  border-radius: 4px;
  color: var(--contentTextColor);
  font-family: var(--fontFamily);
  .el-dialog__header, .el-dialog__footer { flex: none; }
  .el-dialog__body { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; padding: 12px 20px; }
  .file-comparison-hint, .file-comparison-path, .file-comparison-limit { flex: none; margin: 0 0 8px; font-size: 12px; line-height: 1.5; }
  .file-comparison-path { overflow-wrap: anywhere; font-family: JetBrainsMono, ui-monospace, monospace; }
  .file-comparison-status { flex: none; min-height: 32px; font-size: 12px; line-height: 1.5; p { margin: 0 0 8px; } }
  .file-comparison-empty, .file-comparison-placeholder { min-height: 160px; font-size: 13px; }
  .file-comparison-limit { padding-left: 8px; border-left: 2px solid var(--primaryBorderColor); }
  .file-comparison-scroll { min-height: 100px; max-height: 52vh; overflow: auto; scrollbar-gutter: stable;
    border: 1px solid var(--contentBorderColor); border-radius: 4px; }
  .file-comparison-table { width: 100%; border-collapse: collapse; font: 12px/1.6 JetBrainsMono, ui-monospace, monospace; }
  th { position: sticky; top: 0; z-index: 1; text-align: left; background: var(--contentBackgroundColor); border-bottom: 1px solid var(--contentBorderColor); padding: 6px 8px; font-family: var(--fontFamily); }
  th:first-child, th:nth-child(2) { width: 80px; }
  td { vertical-align: top; }
  .file-comparison-number { width: 80px; text-align: right; padding: 0 8px; border-right: 1px solid var(--contentBorderColor); opacity: .8; }
  .file-comparison-code { padding: 0 8px; overflow-wrap: anywhere; }
  .file-comparison-symbol { display: inline-block; width: 18px; font-weight: 700; }
  .file-comparison-text { white-space: pre-wrap; word-break: break-word; }
  .file-comparison-ending { display: inline-block; margin: 0 6px; padding: 0 4px; border: 1px solid var(--contentBorderColor); border-radius: 2px; font: 10px/1.4 var(--fontFamily); }
  .diff-remove { background: color-mix(in srgb, var(--contentBackgroundColor) 86%, #e04b44); }
  .diff-add { background: color-mix(in srgb, var(--contentBackgroundColor) 86%, #369566); }
  .file-comparison-skip { text-align: center; padding: 7px 8px; background: var(--contentBackgroundColorActive); font: 11px/1.5 var(--fontFamily); overflow-wrap: anywhere; }
  .is-stale { border-style: dashed; }
  .file-comparison-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .file-comparison-actions .el-button { margin-left: 0; }
  button:focus-visible, .file-comparison-scroll:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
  button:not(:disabled) { cursor: pointer; }
}
@media (max-width: 520px) {
  .file-comparison-dialog {
    .el-dialog__body { padding: 10px 12px; }
    .file-comparison-number { width: 36px; padding: 0 4px; }
    th:first-child, th:nth-child(2) { width: 50px; }
    .file-comparison-actions { justify-content: stretch; }
    .file-comparison-actions .el-button { flex: 1; }
  }
}
@media (forced-colors: active) { .file-comparison-dialog .diff-add, .file-comparison-dialog .diff-remove { outline: 1px solid CanvasText; } }
</style>
