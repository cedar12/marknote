<template>
  <section class="source-workspace" :class="{ 'source-split': store.sourceMode === 'split' }" :aria-label="t('editorModeSource')">
    <div class="source-pane">
      <div class="source-pane-heading"><label for="markdown-source-document">{{ t('sourceDocumentLabel') }}</label><span>{{ t('sourcePosition', position) }}</span></div>
      <textarea id="markdown-source-document" ref="textarea" data-source-editor class="source-textarea resize-none" wrap="off" spellcheck="false" autocapitalize="off" :value="store.sourceText" :readonly="blocked" :aria-describedby="'source-document-hint'" @input="onInput" @select="rememberSelection" @keyup="rememberSelection" @mouseup="rememberSelection" @scroll="onSourceScroll" @keydown="onKeyDown" @beforeinput="onBeforeInput" @compositionstart="onCompositionStart" @compositionend="onCompositionEnd" @paste="onPaste" @drop.prevent="onDrop"></textarea>
      <div id="source-document-hint" class="source-hint" role="status">{{ editError ? t('sourceChangeTooLarge') : clipboardError ? t('sourceClipboardFailed') : imageHint ? t('sourceImageHint') : t('sourceHistoryHint') }}</div>
    </div>
    <div v-show="store.sourceMode === 'split'" class="source-preview-pane">
      <div class="source-pane-heading"><span>{{ t('sourcePreviewLabel') }}</span><div class="source-preview-actions"><button type="button" :aria-pressed="syncScroll" @click="syncScroll = !syncScroll">{{ t('sourceSyncScroll') }}</button><button type="button" :disabled="!html || pending" @click="locatePreview">{{ t('sourceLocatePreview') }}</button></div></div>
      <div class="source-preview-status" aria-live="polite"><span v-if="pending">{{ t('sourcePreviewPending') }}</span><span v-else-if="failure">{{ t('sourcePreviewFailed') }} <button type="button" @click="schedulePreview(true)">{{ t('retry') }}</button></span><span v-else-if="windowRange?.limited">{{ t('sourcePreviewRange', { from: windowRange.firstLine + 1, to: windowRange.lastLine + 1, total: windowRange.totalLines }) }}</span><span v-else>{{ t('sourcePreviewComplete') }}</span></div>
      <div ref="preview" class="source-preview-scroll" tabindex="0" :aria-label="t('sourcePreviewLabel')" :aria-busy="pending" @scroll="onPreviewScroll">
        <div v-if="pending && !html" v-loading="true" class="source-preview-loading"></div>
        <article v-if="html" class="marknote source-preview-content" v-html="html"></article>
        <p v-else-if="!pending && !failure" class="source-preview-empty">{{ t('sourcePreviewEmpty') }}</p>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { isTauri } from '@tauri-apps/api/core';
import { useEditorStore, type SourceCommand } from '../../store/editor';
import { useAppStore } from '../../store/app';
import { useDraftsStore } from '../../store/drafts';
import { sourcePreviewWindow, sanitizeSourcePreview, sourceTextareaInput, sourceTextareaValue, sourceOffsetToTextarea, textareaOffsetToSource, type SourcePreviewWindow, type SourceSelection } from '../../utils/sourceDocument';
import { resolveDocumentResource } from '../../utils/documentResources';
import { lowlight } from '../../utils/lowlight';
import loading from '../../directives/loading';
import 'katex/dist/katex.min.css';

const store = useEditorStore(), app = useAppStore(), { t } = useI18n();
const vLoading = loading;
const textarea = ref<HTMLTextAreaElement>(), preview = ref<HTMLDivElement>();
const html = ref(''), pending = ref(false), failure = ref(false), imageHint = ref(false), clipboardError = ref(false), editError = ref(false), syncScroll = ref(true);
const windowRange = ref<SourcePreviewWindow>();
const previewOffset = ref(0);
let timer: ReturnType<typeof setTimeout> | undefined, renderVersion = 0, synchronizing = false;
const blocked = computed(() => !store.sourceEditable || app.lifecycleBusy || app.saving || app.exporting || app.loading || store.loading || store.renderingDocument || store.sourceSwitching);
const position = computed(() => { store.sourceVersion; const line = store.sourceDocument.lineAt(store.sourceSelection.from); return { line: line + 1, column: store.sourceSelection.from - store.sourceDocument.lineStarts()[line] + 1 }; });
const selection = (): SourceSelection => ({ from: textarea.value?.selectionStart || 0, to: textarea.value?.selectionEnd || 0, direction: textarea.value?.selectionDirection || 'none' });
const rememberSelection = () => { if (textarea.value) { const value = selection(); store.updateSourceSelection({ ...value, from: textareaOffsetToSource(store.sourceText, value.from), to: textareaOffsetToSource(store.sourceText, value.to) }, textarea.value.scrollTop); } };
const restore = () => {
  const field = textarea.value; if (!field || store.sourceMode === 'wysiwyg') return;
  const visible = sourceTextareaValue(store.sourceText);
  if (field.value !== visible) field.value = visible;
  const range = store.sourceSelection;
  field.setSelectionRange(sourceOffsetToTextarea(store.sourceText, range.from), sourceOffsetToTextarea(store.sourceText, range.to), range.direction);
  field.scrollTop = store.sourceDocument.scrollTop;
};
const focus = () => {
  restore(); const field = textarea.value; if (!field) return;
  field.focus({ preventScroll: true });
  const line = store.sourceDocument.lineAt(store.sourceSelection.from), height = parseFloat(getComputedStyle(field).lineHeight) || 22;
  const top = line * height;
  if (top < field.scrollTop || top > field.scrollTop + field.clientHeight - height) field.scrollTop = Math.max(0, top - field.clientHeight / 3);
  store.sourceDocument.scrollTop = field.scrollTop;
};
const commitField = (group = '') => {
  const field = textarea.value; if (!field) return;
  const input = sourceTextareaInput(store.sourceText, field.value, selection());
  const changed = store.updateSource(input.text, input.selection, group);
  if (!changed && field.value !== sourceTextareaValue(store.sourceText)) { if (!blocked.value) editError.value = true; restore(); }
  else if (changed) editError.value = false;
};
const onInput = (event: Event) => { imageHint.value = false; clipboardError.value = false; commitField(store.sourceComposing ? 'composition' : (event as InputEvent).inputType || 'typing'); };
const onCompositionStart = () => { store.sourceDocument.boundary(); store.sourceComposing = true; };
const onCompositionEnd = () => { commitField('composition'); store.sourceComposing = false; store.sourceDocument.boundary(); schedulePreview(); };
const onBeforeInput = (value: Event) => {
  const event = value as InputEvent;
  if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); if (!store.sourceComposing) { event.inputType === 'historyUndo' ? store.undoSource() : store.redoSource(); void nextTick(restore); } }
};
const replaceSelection = (text: string) => { const field = textarea.value; if (!field || blocked.value || store.sourceComposing) return false;
  const { from, to } = selection(); field.setRangeText(text, from, to, 'end'); commitField(); return true; };
const command = async (action: SourceCommand): Promise<boolean> => {
  if (blocked.value || store.sourceComposing) return false;
  focus(); const field = textarea.value; if (!field) return false;
  clipboardError.value = false;
  if (action === 'selectAll') { field.select(); rememberSelection(); return true; }
  if (action === 'undo' || action === 'redo') { const result = action === 'undo' ? store.undoSource() : store.redoSource(); await nextTick(); restore(); return result; }
  const { from, to } = selection();
  const before = store.sourceDocument, revision = before.revision;
  try {
    if (action === 'copy' || action === 'cut') {
      if (from === to) return false;
      const text = field.value.slice(from, to);
      if (isTauri()) await writeText(text); else await navigator.clipboard.writeText(text);
      if (action === 'cut') {
        const current = selection();
        return before === store.sourceDocument && revision === before.revision && current.from === from && current.to === to && replaceSelection('');
      }
      return true;
    }
    const text = isTauri() ? await readText() : await navigator.clipboard.readText();
    const current = selection();
    if (before !== store.sourceDocument || revision !== before.revision || current.from !== from || current.to !== to || blocked.value || store.sourceComposing) return false;
    return !!text && replaceSelection(text);
  } catch { clipboardError.value = true; return false; }
};
const onKeyDown = (event: KeyboardEvent) => {
  if (event.isComposing || store.sourceComposing || event.keyCode === 229) return;
  const adapter = { undo: () => command('undo'), redo: () => command('redo'), selectAll: () => command('selectAll'), copy: () => command('copy'), cut: () => command('cut'), paste: () => command('paste') };
  if (app.keyBinding?.handleSourceKeyDown(adapter, event)) return;
  // Standalone/browser editor harnesses may not install app key bindings.
  if (!app.keyBinding && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); void command(event.shiftKey ? 'redo' : 'undo'); }
  if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); replaceSelection('\t'); }
};
const onPaste = (event: ClipboardEvent) => { if (event.clipboardData?.files.length) { event.preventDefault(); imageHint.value = true; } };
const onDrop = (event: DragEvent) => { if (event.dataTransfer?.files.length) imageHint.value = true; else { const text = event.dataTransfer?.getData('text/plain'); if (text) replaceSelection(text); } };

function highlightPreview(body: HTMLElement) {
  body.querySelectorAll<HTMLElement>('pre > code').forEach(code => {
    const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9), text = code.textContent || '';
    if (!language || text.length > 12 * 1024 || !lowlight.registered(language)) return;
    try {
      const result = lowlight.highlight(language, text);
      const append = (nodes: any[], target: Node) => { for (const node of nodes) { if (node.type === 'text') target.appendChild(document.createTextNode(node.value)); else { const element = document.createElement('span'); element.className = (node.properties?.className || []).join(' '); append(node.children || [], element); target.appendChild(element); } } };
      code.replaceChildren(); append(result.children, code); code.parentElement?.classList.add('hljs');
    } catch { /* Keep valid plain source if a grammar fails. */ }
  });
}
function schedulePreview(immediate = false) {
  clearTimeout(timer); const version = ++renderVersion;
  if (store.sourceMode !== 'split' || store.sourceComposing) { pending.value = false; return; }
  pending.value = true;
  timer = setTimeout(async () => {
    const document = store.sourceDocument, revision = document.revision, generation = store.documentGeneration;
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (version !== renderVersion || store.sourceMode !== 'split') return;
      const range = sourcePreviewWindow(document, previewOffset.value);
      const parser = store.editor.storage.markdown.parser;
      const rendered = parser.parse(range.content);
      const body = new window.DOMParser().parseFromString(`<body>${rendered}</body>`, 'text/html').body;
      // Native MathML keeps the preview independent of KaTeX layout styles.
      body.querySelectorAll('.katex').forEach(node => { const math = node.querySelector('math'); if (math) node.replaceWith(math.cloneNode(true)); });
      sanitizeSourcePreview(body);
      const tokens = parser.md.parse(range.content, {});
      const mapped = tokens.filter((token: any) => token.level === 0 && token.map && token.nesting !== -1);
      const lineStarts = [0]; for (let index = range.content.indexOf('\n'); index >= 0; index = range.content.indexOf('\n', index + 1)) lineStarts.push(index + 1);
      [...body.children].forEach((element, index) => { const token = mapped[index]; if (token) element.setAttribute('data-source-offset', String(range.from + (lineStarts[token.map[0]] || 0))); });
      body.querySelectorAll('a').forEach(anchor => { const span = window.document.createElement('span'); span.append(...anchor.childNodes); anchor.replaceWith(span); });
      body.querySelectorAll<HTMLImageElement>('img').forEach(image => { try { image.src = resolveDocumentResource(image.getAttribute('src') || '', app.filepath || useDraftsStore().resourceSourcePath, store.attachmentMapping); image.loading = 'lazy'; } catch { image.removeAttribute('src'); } });
      highlightPreview(body);
      if (version !== renderVersion || document !== store.sourceDocument || revision !== document.revision || generation !== store.documentGeneration) return;
      windowRange.value = range; html.value = body.innerHTML; failure.value = false;
      await nextTick(); synchronizePreview(previewOffset.value);
    } catch { if (version === renderVersion) failure.value = true; }
    finally { if (version === renderVersion) pending.value = false; }
  }, immediate ? 0 : 350);
}
const topSourceOffset = () => { const field = textarea.value; if (!field) return 0; const lineHeight = parseFloat(getComputedStyle(field).lineHeight) || 22; const line = Math.max(0, Math.floor((field.scrollTop - 12) / lineHeight)); return store.sourceDocument.lineStarts()[Math.min(line, store.sourceDocument.lineStarts().length - 1)]; };
const nearestPreviewOffset = () => {
  const pane = preview.value; if (!pane) return 0;
  const blocks = [...pane.querySelectorAll<HTMLElement>('[data-source-offset]')];
  const top = pane.getBoundingClientRect().top;
  let found = blocks[0]; for (const block of blocks) { if (block.getBoundingClientRect().top <= top + 16) found = block; else break; }
  return Number(found?.dataset.sourceOffset || windowRange.value?.from || 0);
};
function synchronizePreview(offset: number) {
  if (!syncScroll.value || !preview.value) return;
  let found: HTMLElement | undefined;
  for (const block of preview.value.querySelectorAll<HTMLElement>('[data-source-offset]')) { if (Number(block.dataset.sourceOffset) <= offset) found = block; else break; }
  if (found) { synchronizing = true; preview.value.scrollTop += found.getBoundingClientRect().top - preview.value.getBoundingClientRect().top - 12; requestAnimationFrame(() => { synchronizing = false; }); }
}
const onSourceScroll = () => {
  rememberSelection(); if (!syncScroll.value || synchronizing || store.sourceMode !== 'split') return;
  const offset = topSourceOffset(); previewOffset.value = offset;
  if (!windowRange.value || offset < windowRange.value.from || offset >= windowRange.value.to) schedulePreview();
  else synchronizePreview(offset);
};
const onPreviewScroll = () => {
  if (!syncScroll.value || synchronizing || !textarea.value) return;
  const offset = nearestPreviewOffset();
  synchronizing = true; textarea.value.scrollTop = store.sourceDocument.lineAt(offset) * (parseFloat(getComputedStyle(textarea.value).lineHeight) || 22);
  store.sourceDocument.scrollTop = textarea.value.scrollTop;
  requestAnimationFrame(() => { synchronizing = false; });
};
const locatePreview = () => { const offset = nearestPreviewOffset(); void store.openSourceRange(offset, offset); };

watch(() => store.sourceText, () => { void nextTick(restore); schedulePreview(); });
watch(() => store.sourceMode, () => { void nextTick(restore); schedulePreview(true); });
watch(() => store.documentGeneration, () => { html.value = ''; failure.value = false; previewOffset.value = 0; schedulePreview(true); });
watch(() => store.sourceSelection.from, value => { if (store.sourceMode !== 'split' || !syncScroll.value) return; previewOffset.value = value; if (!windowRange.value || value < windowRange.value.from || value >= windowRange.value.to) schedulePreview(); });
onMounted(() => { store.registerSourceHandlers({ focus, command }); restore(); schedulePreview(true); });
onBeforeUnmount(() => { clearTimeout(timer); renderVersion++; store.registerSourceHandlers(null); store.sourceComposing = false; });
</script>
<style scoped lang="scss">
.source-workspace { display:grid;grid-template-columns:minmax(0,1fr);height:calc(100vh - var(--titleBarHeight,30px));min-height:260px;min-width:0;color:var(--contentTextColor);background:var(--contentBackgroundColor); }
.source-split { grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
.source-pane,.source-preview-pane { min-width:0;min-height:0;display:flex;flex-direction:column; }
.source-preview-pane { border-left:1px solid var(--contentBorderColor); }
.source-pane-heading { min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 12px;box-sizing:border-box;font-size:12px;border-bottom:1px solid var(--contentBorderColor);flex-wrap:wrap; }
.source-textarea { flex:1;min-height:0;width:100%;box-sizing:border-box;border:0;resize:none;padding:12px;white-space:pre;overflow:auto;scrollbar-gutter:stable;font:14px/22px JetBrainsMono,ui-monospace,monospace;tab-size:var(--tabSize,4);color:var(--contentTextColor);background:var(--contentBackgroundColor);outline:none;
  &:focus-visible { outline:2px solid var(--primaryTextColor);outline-offset:-2px; }
}
.source-hint,.source-preview-status { flex:none;min-height:28px;font-size:12px;padding:5px 12px;box-sizing:border-box;overflow-wrap:anywhere;border-top:1px solid var(--contentBorderColor); }
.source-preview-status { border-top:0;border-bottom:1px solid var(--contentBorderColor); }
.source-preview-scroll { flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable; }
.source-preview-loading { min-height:240px;height:100%; }
.source-preview-content { min-height:0;padding:16px 24px;overflow-wrap:anywhere;
  :deep(pre) { overflow:auto;max-width:100%;white-space:pre; }
  :deep(img) { max-width:100%;height:auto; }
}
.source-preview-empty { padding:16px 24px; }
.source-preview-actions { display:flex;gap:4px; }
button { font:inherit;font-size:12px;min-height:24px;padding:2px 7px;border:1px solid var(--contentBorderColor);border-radius:4px;color:var(--contentTextColor);background:var(--contentBackgroundColor);cursor:pointer;
  &:hover:not(:disabled) { background:var(--contentBackgroundColorHover); }
  &:active:not(:disabled),&[aria-pressed="true"] { background:var(--contentBackgroundColorActive); }
  &:focus-visible { outline:2px solid var(--primaryTextColor);outline-offset:1px; }
  &:disabled { opacity:.5;cursor:default; }
}
@media(max-width:700px) { .source-split { grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr); }.source-preview-pane { border-left:0;border-top:1px solid var(--contentBorderColor); }.source-preview-content { padding:12px; } }
</style>
