<template>
  <section class="preferences-markdown-options" :aria-label="t('markdown')" :aria-busy="preferences.loadingMarkdown || preferences.savingMarkdown">
    <h2>{{ t('markdown') }}</h2>
    <p class="markdown-help">{{ t('markdownApplyHint') }}</p>
    <div class="markdown-status" aria-live="polite">
      <span v-if="preferences.loadingMarkdown">{{ t('loadingPreferences') }}</span>
      <span v-else-if="preferences.savingMarkdown">{{ t('savingPreferences') }}</span>
      <span v-else-if="saved">{{ t('preferencesSaved') }}</span>
    </div>
    <p v-if="preferences.markdownSyncError" class="markdown-sync-error" role="alert">{{ t('preferencesSyncFailed') }}</p>
    <div v-if="preferences.markdownLoadError || failedPatch" class="markdown-error" role="alert">
      <span>{{ t(preferences.markdownLoadError ? 'preferencesLoadFailed' : 'preferencesSaveFailed') }}</span>
      <ElButton size="small" :disabled="busy" @click="retry">{{ t('retry') }}</ElButton>
    </div>
    <div v-for="group in groups" :key="group.title" class="preferences-item">
      <h3 class="header">{{ t(group.title) }}</h3>
      <div class="content">
        <div v-for="option in group.options" :key="option.key" class="markdown-option">
          <div class="markdown-option-copy">
            <label :id="`markdown-${option.key}-label`" :for="`markdown-${option.key}`">{{ t(option.label) }}</label>
            <p :id="`markdown-${option.key}-hint`">{{ t(option.hint) }}</p>
          </div>
          <ElSwitch :id="`markdown-${option.key}`" :model-value="preferences.markdown[option.key]" :disabled="disabled" :label="t(option.label)" v-described-by="`markdown-${option.key}-hint`" @change="value => save({ [option.key]: Boolean(value) })" />
        </div>
        <div v-if="group.title === 'markdownOutput'" class="markdown-marker">
          <label id="markdown-marker-label" for="markdown-bullet-marker">{{ t('markdownBulletMarker') }}</label>
          <ElSelect id="markdown-bullet-marker" :model-value="preferences.markdown.bulletListMarker" :disabled="disabled" :aria-label="t('markdownBulletMarker')" @change="value => save({ bulletListMarker: value })">
            <ElOption :label="t('markdownBulletDash')" value="-" />
            <ElOption :label="t('markdownBulletStar')" value="*" />
            <ElOption :label="t('markdownBulletPlus')" value="+" />
          </ElSelect>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, type Directive } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElButton, ElSwitch, ElSelect, ElOption } from 'element-plus';
import { usePreferencesStore, type MarkdownPreferences } from '../../store/preferences';

const { t } = useI18n();
const preferences = usePreferencesStore();
// Element Plus 2.3 places unknown ARIA attributes on the wrapper, so attach the hint to its input.
const describeInput = (element: HTMLElement, id: string) => element.querySelector('input')?.setAttribute('aria-describedby', id);
const vDescribedBy: Directive<HTMLElement, string> = {
  mounted: (element, binding) => describeInput(element, binding.value),
  updated: (element, binding) => describeInput(element, binding.value),
};
const saved = ref(false);
const failedPatch = ref<Partial<MarkdownPreferences> | null>(null);
const busy = computed(() => preferences.loadingMarkdown || preferences.savingMarkdown);
const disabled = computed(() => busy.value || !preferences.markdownLoaded || Boolean(preferences.markdownLoadError));
type BooleanOption = Exclude<keyof MarkdownPreferences, 'bulletListMarker'>;
const groups: { title: string; options: { key: BooleanOption; label: string; hint: string }[] }[] = [
  { title: 'markdownParsing', options: [
    { key: 'breaks', label: 'markdownBreaks', hint: 'markdownBreaksHint' },
    { key: 'linkify', label: 'markdownLinkify', hint: 'markdownLinkifyHint' },
    { key: 'typographer', label: 'markdownTypographer', hint: 'markdownTypographerHint' },
    { key: 'html', label: 'markdownHtml', hint: 'markdownHtmlHint' },
  ] },
  { title: 'markdownOutput', options: [
    { key: 'tightLists', label: 'markdownTightLists', hint: 'markdownTightListsHint' },
  ] },
  { title: 'markdownClipboard', options: [
    { key: 'transformPastedText', label: 'markdownPaste', hint: 'markdownPasteHint' },
    { key: 'transformCopiedText', label: 'markdownCopy', hint: 'markdownCopyHint' },
  ] },
];

async function load() {
  try { await preferences.loadMarkdownPreferences(); } catch { /* The store owns the recoverable load error. */ }
}
onMounted(load);

async function save(patch: Partial<MarkdownPreferences>) {
  if (busy.value) return;
  saved.value = false;
  failedPatch.value = null;
  try {
    await preferences.saveMarkdownPreferences(patch);
    saved.value = true;
  } catch { failedPatch.value = patch; }
}

async function retry() {
  if (preferences.markdownLoadError) await load();
  else if (failedPatch.value) await save(failedPatch.value);
}
</script>

<style lang="scss">
.preferences-markdown-options {
  h2 { font-size: 20px; margin: 18px 0 10px; }
  h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .markdown-help { font-size: 12px; line-height: 1.6; margin: 0; }
  .markdown-status { min-height: 20px; margin: 8px 0; font-size: 12px; }
  .markdown-sync-error { font-size: 12px; line-height: 1.5; }
  .markdown-error { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 12px; }
  .markdown-option { display: flex; align-items: center; gap: 16px; padding: 10px 0; }
  .markdown-option-copy { flex: 1; min-width: 0; }
  .markdown-option-copy label { font-size: 14px; cursor: pointer; }
  .markdown-option-copy p { margin: 4px 0 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
  .markdown-marker { display: grid; gap: 8px; padding: 8px 0 12px; font-size: 14px; }
  .el-switch { flex: none; }
}
</style>
