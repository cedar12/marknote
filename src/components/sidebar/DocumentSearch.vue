<template>
  <section class="document-search" :aria-label="t('documentSearch')" :aria-busy="search.busy">
    <div class="document-search-controls">
      <label for="document-search-scope">{{ t('searchScope') }}</label>
      <ElSelect id="document-search-scope" v-model="search.scope" v-control-a11y="{ id: 'document-search-scope', label: t('searchScope') }" :disabled="search.locating || search.previewing" @change="search.schedule()">
        <ElOption value="document" :label="t('searchWholeDocument')" /><ElOption value="workspace" :label="t('searchWorkspace')" />
      </ElSelect>
      <div class="document-search-query">
        <input id="document-search-query" ref="queryInput" v-model="search.query" :aria-label="t('searchLiteralQuery')" :placeholder="t('searchLiteralQuery')" :disabled="search.locating || search.previewing" @input="queryChanged" @compositionstart="beginComposition" @compositionend="endComposition" @keydown="queryKeydown" />
        <button type="button" :disabled="!search.query || search.locating || search.previewing || search.composing" :aria-label="t('clearSearch')" :title="t('clearSearch')" @click="clear"><CloseSmall aria-hidden="true" /></button>
      </div>
      <label class="document-search-case"><input v-model="search.matchCase" type="checkbox" :disabled="search.locating || search.previewing || search.composing" @change="search.schedule()" />{{ t('searchMatchCase') }}</label>
      <p class="document-search-hint">{{ t(search.scope === 'document' ? 'searchSourceHint' : 'searchWorkspaceHint') }}</p>
      <div class="document-search-status" aria-live="polite">
        <template v-if="search.searching"><span>{{ t('searchSearching') }}</span><button type="button" @click="search.cancel()">{{ t('searchCancel') }}</button></template>
        <span v-else-if="search.cancelled">{{ t('searchCancelled') }}</span>
        <span v-else-if="search.completed">{{ t('searchResults', { count: search.results.length }) }}</span>
        <span v-else-if="!search.query">{{ t('searchQueryPrompt') }}</span>
      </div>
      <div v-if="search.errorKey || search.replaceError" class="document-search-alert" role="alert"><span>{{ t(search.errorKey || search.replaceError || '') }}</span><button type="button" :disabled="search.busy || search.composing" @click="retry">{{ t('retry') }}</button></div>
      <div v-if="search.stale" class="document-search-alert" role="status"><span>{{ t('searchStale') }}</span><button type="button" :disabled="search.busy || search.composing" @click="search.search()">{{ t('searchRefresh') }}</button></div>
      <p v-if="search.truncated" class="document-search-hint" role="status">{{ t('searchLimited') }}</p>
      <p v-if="search.workspaceProgress" class="document-search-progress">{{ t('searchProgress', { files: search.workspaceProgress.scannedFiles, skipped: search.workspaceProgress.skippedFiles }) }}<span v-if="search.workspaceProgress.skippedFiles">{{ t('searchSkippedDetails', search.workspaceProgress.skipReasons) }}</span></p>
      <details v-if="search.scope === 'workspace'" class="document-search-limits"><summary>{{ t('searchScope') }}</summary>{{ t('searchLimits') }}</details>
      <div v-if="search.scope === 'document'" class="document-search-replace">
        <label for="document-search-replacement">{{ t('replace') }}</label><input id="document-search-replacement" v-model="search.replacement" maxlength="4096" :disabled="search.busy || search.composing" @compositionstart="replacementComposing = true" @compositionend="replacementComposing = false" />
        <div><button type="button" :disabled="cannotReplace" @click="previewReplacement(false)">{{ t('searchReplaceOne') }}</button><button type="button" :disabled="cannotReplace" @click="previewReplacement(true)">{{ t('searchReplaceAll') }}</button></div>
      </div>
    </div>
    <ElScrollbar class="document-search-results">
      <p v-if="search.completed && !search.results.length && !search.errorKey" class="document-search-empty" role="status">{{ t('searchNoMatches') }}</p>
      <ol aria-label="" v-if="search.results.length">
        <li v-for="(result, index) in search.results" :key="`${'path' in result ? result.path : ''}:${result.from}:${index}`">
          <button type="button" class="document-search-result" :class="{ selected: search.selected === index }" :disabled="search.searching || search.locating || search.previewing || search.stale || search.documentBusy || search.composing" @click="search.locate(index)">
            <strong>{{ 'relativePath' in result ? result.relativePath : t('searchCurrentFile') }}</strong><small>{{ t('searchPosition', { line: result.line, column: result.column }) }}</small>
            <span class="document-search-snippet">{{ result.before }}<mark>{{ result.matched }}</mark>{{ result.after }}</span>
          </button>
        </li>
      </ol>
    </ElScrollbar>
    <ElDialog append-to-body data-shortcut-capture :model-value="Boolean(search.replacementPreview)" :title="t('searchReplacePreview')" :width="'min(620px, calc(100vw - 32px))'" :close-on-click-modal="false" :close-on-press-escape="!search.locating" :show-close="!search.locating" @close-auto-focus="previewClosed" @closed="previewClosed" @update:model-value="value => { if (!value && !search.locating) search.replacementPreview = null; }">
      <p>{{ t('searchReplaceCount', { count: search.replacementPreview?.ranges.length || 0 }) }}</p><p>{{ t('searchReplaceUndoHint') }}</p>
      <div v-for="(example, index) in previewExamples" :key="index" class="document-search-preview">
        <strong>{{ t('searchReplaceBefore') }}</strong><pre>{{ example.before }}</pre><strong>{{ t('searchReplaceAfter') }}</strong><pre>{{ example.after }}</pre>
      </div>
      <template #footer><ElButton :disabled="search.locating" @click="search.replacementPreview = null">{{ t('cancel') }}</ElButton><ElButton type="primary" :loading="search.locating" :disabled="search.documentBusy || search.composing" @click="confirmReplacement">{{ t('searchConfirmReplace') }}</ElButton></template>
    </ElDialog>
  </section>
</template>
<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { ElScrollbar, ElDialog, ElButton, ElSelect, ElOption } from 'element-plus';
import { CloseSmall } from '@icon-park/vue-next';
import { useI18n } from 'vue-i18n';
import { useDocumentSearchStore } from '../../store/documentSearch';
import { useAppStore } from '../../store/app';
import { useEditorStore } from '../../store/editor';
import { sourceSnippet } from '../../utils/documentSearch';
import { vControlA11y } from '../../directives/controlA11y';
const { t } = useI18n(), search = useDocumentSearchStore(), app = useAppStore(), editor = useEditorStore();
const queryInput = ref<HTMLInputElement>(), replacementComposing = ref(false);
let restoreQueryAfterPreview = true;
const cannotReplace = computed(() => !search.results.length || search.busy || search.documentBusy || search.stale || search.composing || replacementComposing.value);
const previewExamples = computed(() => search.replacementPreview?.ranges.slice(0, 3).map(range => {
  const source = search.replacementPreview!.original, snippet = sourceSnippet(source, range.from, range.to);
  return { before: snippet.before + snippet.matched + snippet.after, after: snippet.before + range.replacement + snippet.after };
}) || []);
function queryChanged(event: Event) { search.query = (event.target as HTMLInputElement).value; if (!(event as InputEvent).isComposing && !search.composing) search.schedule(); }
function beginComposition() { search.composing = true; search.cancel(false); }
function endComposition(event: CompositionEvent) { search.composing = false; search.query = (event.target as HTMLInputElement).value; search.schedule(); }
function clear() { search.clear(); queryInput.value?.focus(); }
function retry() { search.replaceError = null; void search.search(); }
async function previewReplacement(all: boolean) { restoreQueryAfterPreview = true; await search.previewReplacement(all); }
async function confirmReplacement() { restoreQueryAfterPreview = !await search.confirmReplacement(); }
async function previewClosed() { await nextTick(); if (restoreQueryAfterPreview) queryInput.value?.focus(); else editor.focus(); }
function queryKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229 || search.composing) return;
  if (event.key === 'Escape') { event.preventDefault(); if (search.searching) search.cancel(); else clear(); }
  if (event.key === 'Enter') { event.preventDefault(); if (search.completed && search.results.length && !search.stale) void search.locate((search.selected + (event.shiftKey ? -1 : 1) + search.results.length) % search.results.length); else void search.search(); }
}
watch(() => [app.editRevision, editor.documentGeneration, app.filepath], () => { if (search.scope === 'document') search.invalidate(); });
watch(() => app.folder, () => { if (search.scope === 'workspace') search.invalidate(); });
watch(() => app.sidebar.active, active => {
  if (active === 'search') void nextTick(() => queryInput.value?.focus());
  else if (search.searching) search.cancel();
}, { immediate: true });
watch(() => search.focusRequest, () => { void nextTick(() => queryInput.value?.focus()); });
onBeforeUnmount(() => { search.composing = false; search.cancel(false); });
</script>
<style lang="scss">
.document-search { display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;font-size:12px;
  --el-fill-color-blank:var(--primaryBackgroundColor);
  --el-text-color-regular:var(--primaryTextColor);
  --el-border-color:var(--primaryBorderColor);
  .document-search-controls { flex:none;padding:4px 6px 4px 0;min-width:0;max-height:65%;overflow:auto; }
  .el-select { width:100%; }
  #document-search-query,#document-search-replacement { width:100%;min-width:0;box-sizing:border-box;border:1px solid var(--primaryBorderColor);border-radius:3px;background:var(--primaryBackgroundColor);color:inherit;font:inherit;padding:5px; }
  input[type="checkbox"] { margin:0 5px 0 0; }
  button { color:inherit;background:transparent;border:1px solid var(--primaryBorderColor);border-radius:3px;font:inherit;cursor:pointer;padding:4px 6px; }
  button:disabled { opacity:.55;cursor:default; }
  button:focus-visible,select:focus-visible,input:focus-visible { outline:2px solid var(--primaryTextColorActive);outline-offset:-2px; }
  .document-search-query { display:flex;gap:4px;margin:6px 0;input{flex:1;}button{display:flex;align-items:center;flex:none;} }
  .document-search-case { display:flex;align-items:center; }
  .document-search-hint,.document-search-progress { line-height:1.5;margin:6px 0;overflow-wrap:anywhere; }
  .document-search-progress span { display:block;margin-top:4px; }
  .document-search-status,.document-search-alert { display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-height:24px;line-height:1.5; }
  .document-search-alert { padding:5px;border:1px solid var(--primaryBorderColor);margin:5px 0; }
  .document-search-limits { line-height:1.5;margin:6px 0;summary{cursor:pointer;} }
  .document-search-replace { border-top:1px solid var(--primaryBorderColor);padding-top:6px;margin-top:6px;>div{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;} }
  .document-search-results { flex:1;min-height:0;ol{margin:0;padding:0;list-style:none;}li{margin:4px 6px 4px 0;} }
  .document-search-result { display:block;width:100%;text-align:left;overflow-wrap:anywhere;border:0;border-bottom:1px solid var(--primaryBorderColor);padding:6px 4px;strong,small{display:block;}small{margin:3px 0;opacity:.8;} &.selected,&:hover{background:var(--primaryBackgroundColorHover);} }
  .document-search-snippet { display:block;white-space:pre-wrap;max-height:100px;overflow:hidden;mark{background:var(--primaryBackgroundColorActive);color:var(--primaryTextColorActive);font-weight:600;} }
  .document-search-empty { margin:6px;line-height:1.5; }
}
.document-search-preview { margin:10px 0;pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:120px;overflow:auto;background:var(--contentBackgroundColorHover);padding:8px;color:var(--contentTextColor);font:inherit;} }
</style>
