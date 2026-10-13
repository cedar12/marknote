<template>
  <div v-if="drafts.errorKey || (!drafts.visible && drafts.recoverable.length) || drafts.recoveredSource !== null" class="draft-recovery-notice">
    <p v-if="drafts.errorKey" role="alert">{{ t(drafts.errorKey) }}</p>
    <p v-else-if="drafts.recoverable.length" role="status">{{ t('draftAvailable', { count: drafts.recoverable.length }) }}</p>
    <p v-else role="status">{{ t('draftRestoredCopy') }}</p>
    <ElButton v-if="drafts.errorKey" size="small" :disabled="drafts.pending || drafts.saving" @click="drafts.retry()">{{ t('retry') }}</ElButton>
    <ElButton v-if="drafts.recoverable.length && !drafts.visible" size="small" @click="drafts.review()">{{ t('draftReview') }}</ElButton>
  </div>
  <ElConfigProvider :locale="elLocale">
    <ElDialog
      class="draft-recovery-dialog"
      data-shortcut-capture
      :model-value="drafts.visible"
      :title="t('draftRecoveryTitle')"
      width="560px"
      top="8vh"
      :z-index="100100"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="!drafts.pending"
      :show-close="!drafts.pending"
      :before-close="beforeClose"
      @update:model-value="value => { if (!value) drafts.defer(); }"
      @opened="focusSafeAction"
      @closed="restoreEditorFocus"
    >
      <p class="draft-recovery-hint">{{ t('draftRecoveryHint') }}</p>
      <ul class="draft-recovery-list" :aria-label="t('draftRecoveryTitle')">
        <li v-for="draft in drafts.recoverable" :key="draft.id">
          <button type="button" class="draft-recovery-item" :aria-pressed="drafts.selectedId === draft.id" :disabled="drafts.pending" @click="select(draft.id)">
            <span class="draft-recovery-title">{{ draft.title || t('draftUntitled') }}</span>
            <span v-if="draft.sourcePath" class="draft-recovery-path">{{ draft.sourcePath }}</span>
            <time :datetime="new Date(draft.updatedAt).toISOString()">{{ formatTime(draft.updatedAt) }}</time>
          </button>
        </li>
      </ul>
      <div class="draft-recovery-status" :role="drafts.errorKey ? 'alert' : 'status'" aria-live="polite">
        <p v-if="drafts.pending">{{ t('draftWorking') }}</p>
        <p v-else-if="drafts.errorKey">{{ t(drafts.errorKey) }} <ElButton size="small" @click="drafts.retry()">{{ t('retry') }}</ElButton></p>
      </div>
      <div v-if="drafts.discardingId" class="draft-discard-confirmation">
        <p>{{ t('draftDiscardConfirm', { title: selected?.title || t('draftUntitled') }) }}</p>
        <ElButton ref="cancelDiscardRef" :disabled="drafts.pending" @click="drafts.discardingId = null">{{ t('cancel') }}</ElButton>
        <ElButton type="danger" :loading="drafts.pending" :disabled="drafts.pending" @click="drafts.discard()">{{ t('draftDiscardAction') }}</ElButton>
      </div>
      <template #footer>
        <div class="draft-recovery-actions">
          <ElButton class="draft-discard-start" :disabled="drafts.pending || !drafts.selectedId || Boolean(drafts.discardingId)" @click="confirmDiscard">{{ t('draftDiscard') }}</ElButton>
          <ElButton ref="deferRef" :disabled="drafts.pending" @click="drafts.defer()">{{ t('draftLater') }}</ElButton>
          <ElButton class="draft-restore-action" type="primary" :loading="drafts.pending && !drafts.discardingId" :disabled="drafts.pending || !drafts.selectedId || Boolean(drafts.discardingId)" @click="drafts.restore()">{{ t('draftRestore') }}</ElButton>
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
import { useDraftsStore } from '../../store/drafts';
import { useEditorStore } from '../../store/editor';

const { t, locale } = useI18n();
const drafts = useDraftsStore();
const editor = useEditorStore();
const elLocale = computed(() => locale.value === 'zhCn' ? zhCn : en);
const selected = computed(() => drafts.recoverable.find(draft => draft.id === drafts.selectedId));
const deferRef = ref<InstanceType<typeof ElButton>>();
const cancelDiscardRef = ref<InstanceType<typeof ElButton>>();
const formatTime = (time: number) => new Intl.DateTimeFormat(locale.value === 'zhCn' ? 'zh-CN' : 'en', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(time);

function select(id: string) { drafts.selectedId = id; drafts.discardingId = null; }
function focusSafeAction() { deferRef.value?.$el.focus(); }
async function confirmDiscard() {
  drafts.discardingId = drafts.selectedId;
  await nextTick();
  cancelDiscardRef.value?.$el.focus();
}
function beforeClose(done: () => void) { if (!drafts.pending) { drafts.defer(); done(); } }
async function restoreEditorFocus() {
  await nextTick();
  if (!drafts.visible) editor.editor?.commands.focus(undefined, { scrollIntoView: false });
}
</script>

<style lang="scss">
.draft-recovery-notice {
  position: fixed;
  bottom: 12px;
  right: 12px;
  z-index: 100099;
  max-width: min(460px, calc(100vw - 24px));
  padding: 10px 12px;
  border: 1px solid var(--contentBorderColor);
  border-radius: 4px;
  background: var(--contentBackgroundColor);
  color: var(--contentTextColor);
  font: 12px/1.5 var(--fontFamily);
  box-shadow: 0 2px 8px #0002;
  p { margin: 0 0 6px; }
  .el-button:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
}
.draft-recovery-dialog {
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
  max-height: calc(100dvh - 8vh - 24px);
  border-radius: 4px;
  color: var(--contentTextColor);
  font-family: var(--fontFamily);
  .el-dialog__header, .el-dialog__footer { flex: none; }
  .el-dialog__body { min-height: 0; overflow-y: auto; padding: 12px 20px; }
  .draft-recovery-hint { margin: 0 0 12px; font-size: 12px; line-height: 1.6; }
  .draft-recovery-list { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow-y: auto; }
  .draft-recovery-list li + li { margin-top: 6px; }
  .draft-recovery-item {
    display: grid; gap: 4px; width: 100%; padding: 10px 12px; text-align: left;
    border: 1px solid var(--contentBorderColor); border-radius: 4px;
    background: var(--contentBackgroundColor); color: var(--contentTextColor); font-family: inherit;
    cursor: pointer; overflow-wrap: anywhere;
    &:hover, &[aria-pressed="true"] { background: var(--contentBackgroundColorActive); }
    &[aria-pressed="true"] { border-color: var(--primaryBorderColor); }
    &:disabled { cursor: default; opacity: .7; }
  }
  .draft-recovery-title { font-size: 14px; font-weight: 600; }
  .draft-recovery-path, time { font-size: 12px; line-height: 1.4; }
  .draft-recovery-status { min-height: 32px; font-size: 12px; p { margin: 8px 0; } }
  .draft-discard-confirmation { border-top: 1px solid var(--contentBorderColor); padding-top: 8px; font-size: 12px; line-height: 1.5; }
  .draft-recovery-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  .draft-recovery-actions .el-button { margin-left: 0; }
  .draft-discard-start { margin-right: auto; }
  .draft-restore-action { min-width: 100px; }
  button:focus-visible, .el-dialog__headerbtn:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
}
@media (prefers-reduced-motion: reduce) { .draft-recovery-dialog .is-loading { animation: none; } }
</style>
