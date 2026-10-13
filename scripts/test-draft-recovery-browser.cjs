/* Real editor, recovery dialog, draft store, browser storage and cross-tab Web Locks.
 * Native file/dialog IPC is simulated. Run: node scripts/test-draft-recovery-browser.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required. Set MARKNOTE_PLAYWRIGHT_PATH.');
}
function browserOptions(chromium) {
  if (process.env.MARKNOTE_BROWSER_PATH) return { executablePath: process.env.MARKNOTE_BROWSER_PATH };
  if (fs.existsSync(chromium.executablePath())) return {};
  const executablePath = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(value => fs.existsSync(value));
  if (!executablePath) throw new Error('Install Chromium or set MARKNOTE_BROWSER_PATH.');
  return { executablePath };
}
const harness = String.raw`<template>
  <main :inert="drafts.visible"><EditorContent :editor="editor" /></main>
  <DraftRecoveryDialog />
</template>
<script setup>
import { nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { createEditor } from '/src/utils/editor';
import { useAppStore } from '/src/store/app';
import { useEditorStore } from '/src/store/editor';
import { useDraftsStore } from '/src/store/drafts';
import { DRAFT_PREFIX, DRAFT_OWNER_PREFIX } from '/src/utils/draftRecovery';
import DraftRecoveryDialog from '/src/components/dialog/DraftRecoveryDialog.vue';
import themes, { setTheme } from '/src/theme';
import i18n from '/src/i18n';
const app = useAppStore();
const document = useEditorStore();
const drafts = useDraftsStore();
app.loading = false;
app.isSave = true;
const editor = createEditor();
watch(editor, value => { if (value) document.setEditor(value); }, { immediate: true });
onMounted(() => drafts.init());
window.__draftTest = {
  translate(key) { return i18n.global.t(key); },
  async locale(value) { i18n.global.locale.value = value; await nextTick(); },
  async theme(kind) { const theme = themes.find(item => item.value === kind); app.theme = theme; setTheme(theme); await nextTick(); },
  snapshot() {
    return { ready: drafts.registered && Boolean(document.editor), error: drafts.errorKey, visible: drafts.visible,
      records: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(key => key.startsWith(DRAFT_PREFIX)).map(key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }).filter(Boolean),
      recoverable: drafts.recoverable.map(draft => ({ ...draft })), filepath: app.filepath, isSave: app.isSave,
      pending: drafts.pending,
      markdown: document.getMarkdown(), rendering: document.renderingDocument, segmented: document.segmented,
      segmentCount: document.segmentCount, sourcePath: drafts.resourceSourcePath, cleanupPending: app.draftCleanupPending,
      documentJSON: editor.value?.getJSON(),
    };
  },
  async fixture({ markdown, path = null, dirty = true, autoSave = false }) {
    drafts.defer();
    await drafts.clearCurrent();
    app.autoSave = autoSave;
    app.setFilepath(path);
    await document.setContent(markdown);
    if (dirty) app.markEdited(); else app.isSave = true;
    await nextTick();
    if (dirty) await drafts.capture();
  },
  async edit(text) { editor.value.commands.insertContent(text); await nextTick(); await drafts.capture(); },
  async capture() { await drafts.capture(); },
  async refresh() { await drafts.refresh(); },
  async restore(id) { await drafts.restore(id); },
  async clear() { return drafts.clearCurrent(); },
  async save() { return app.save(); },
  async seed({ id, markdown, sourcePath = null, title = '', updatedAt = Date.now() }) {
    localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify({ schemaVersion: 1, id, owner: '99999999-9999-4999-8999-999999999999', title, sourcePath, markdown, updatedAt }));
    await drafts.refresh();
    await nextTick();
  },
  failNextRender() {
    const original = document.renderEditorBody;
    document.renderEditorBody = async function(content) { document.renderEditorBody = original; throw new Error('Injected render failure'); };
  },
  async discardGuard() { return app.guardUnsavedChanges(); },
  async prepareDeleteRace() {
    const original = Storage.prototype.removeItem;
    window.__draftDeleteRace = true;
    Storage.prototype.removeItem = function(key) {
      if (key.startsWith(DRAFT_PREFIX) && window.__draftDeleteRace) {
        window.__draftDeleteRace = false;
        editor.value.commands.insertContent('Edit during cleanup');
      }
      return original.call(this, key);
    };
  },
};
onBeforeUnmount(() => { drafts.dispose(); document.setEditor(undefined); });
</script>
<style>html,body { margin:0; height:100%; } main { padding:48px 30px; }</style>`;

function nativeMock() {
  window.os = 'windows';
  window.isTauri = false;
  const state = { calls: [], failWrite: false, failRemove: false, failOwner: false, dialogChoice: 'Cancel' };
  window.__draftNative = state;
  const setItem = Storage.prototype.setItem;
  const removeItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function(key, value) {
    if (key.startsWith('marknote.draft-owner.') && state.failOwner) throw new Error('Injected owner registration failure');
    if (key.startsWith('marknote.draft.') && state.failWrite) throw new Error('Injected quota failure');
    return setItem.call(this, key, value);
  };
  Storage.prototype.removeItem = function(key) {
    if (key.startsWith('marknote.draft.') && state.failRemove) throw new Error('Injected removal failure');
    return removeItem.call(this, key);
  };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'window_1' }, currentWebview: { label: 'window_1' } },
    convertFileSrc(value) { return value; }, transformCallback() { return 1; }, unregisterCallback() {},
    async invoke(command, args = {}) {
      state.calls.push({ command, args });
      if (command === 'get_config') return { code: 0, data: {} };
      if (command === 'save_md') return { code: 0, info: args.path };
      if (command === 'save_as_md') return { code: 0, info: 'C:\\notes\\recovered-copy.md' };
      if (command === 'plugin:dialog|message') return state.dialogChoice;
      if (command.startsWith('plugin:window|') || command.startsWith('plugin:log|') || command === 'log_error') return;
      throw new Error('Unexpected native command: ' + command);
    },
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.draft-recovery-browser-test-'));
  let server, browser;
  const errors = [];
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';", "import { createPinia } from 'pinia';", "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';", "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';", "import '/src/scss/editor.scss';",
      "import Harness from './Harness.vue';", "createApp(Harness).use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:"><title>Draft recovery test</title></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const config = { root, configFile: false, plugins: [vue()], logLevel: 'error',
      build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } },
      preview: { host: '127.0.0.1', port: 0, strictPort: false } };
    console.log('Building isolated draft recovery browser harness');
    await build(config);
    server = await preview(config);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, reducedMotion: 'reduce' });
    await context.addInitScript(nativeMock);
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(error.message); console.error('Page error:', error.message); });
    await page.goto(url);
    await page.waitForFunction(() => window.__draftTest?.snapshot().ready);
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__draftTest[method](argument), { method, argument });
    const label = key => api('translate', key);
    const dialog = () => page.getByRole('dialog');
    const record = message => console.log('PASS ' + message);
    const screenshots = path.join(root, 'outputs');
    fs.mkdirSync(screenshots, { recursive: true });
    const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    await api('fixture', { markdown: '# Untitled\n\nUnsaved original\n', dirty: true });
    let state = await api('snapshot');
    assert.equal(state.records.length, 1);
    assert.equal(state.records[0].sourcePath, null);
    assert.match(state.records[0].markdown, /Unsaved original/);
    const second = await context.newPage();
    await second.goto(url);
    await second.waitForFunction(() => window.__draftTest?.snapshot().ready);
    assert.equal(await second.evaluate(() => window.__draftTest.snapshot().recoverable.length), 0);
    await second.evaluate(() => window.__draftTest.fixture({ markdown: '# Other window\n\nKeep separate\n', dirty: true }));
    const bothWindows = await api('snapshot');
    assert.equal(bothWindows.records.length, 2, JSON.stringify({ first: bothWindows,
      second: await second.evaluate(() => window.__draftTest.snapshot()) }));
    record('Untitled drafts persist independently and active windows never offer each other drafts');

    await page.reload();
    await page.waitForFunction(() => window.__draftTest?.snapshot().ready && window.__draftTest.snapshot().visible);
    assert.equal((await api('snapshot')).recoverable.length, 1);
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
    await page.screenshot({ path: path.join(screenshots, 'draft-recovery-english.png') });
    await dialog().getByRole('button', { name: await label('draftLater'), exact: true }).press('Escape');
    await page.waitForFunction(() => !window.__draftTest.snapshot().visible);
    assert.equal((await api('snapshot')).records.length, 2);
    await page.getByRole('button', { name: await label('draftReview'), exact: true }).click();
    await dialog().getByRole('button', { name: await label('draftRestore'), exact: true }).click();
    await page.waitForFunction(() => !window.__draftTest.snapshot().visible && !window.__draftTest.snapshot().isSave);
    assert.equal((await api('snapshot')).filepath, null);
    await api('save');
    assert.equal((await api('snapshot')).records.length, 1, 'Save clears this draft while retaining the other window');
    record('Reload offers the interrupted draft; Escape defers without deleting; recovery is a dirty copy and Save clears only it');

    await api('fixture', { markdown: '# Existing\n\nDo not lose this document\n', path: 'C:\\notes\\existing.md', dirty: true });
    await api('seed', { id: idA, title: 'original.md', sourcePath: 'C:\\notes\\original.md', markdown: '# Recovered\n\nDraft body\n' });
    await page.getByRole('button', { name: await label('draftReview'), exact: true }).click();
    const before = await api('snapshot');
    await dialog().getByRole('button', { name: await label('draftRestore'), exact: true }).click();
    assert.deepEqual((await api('snapshot')).documentJSON, before.documentJSON, 'Canceling the unsaved guard preserves the current document');
    assert.equal((await api('snapshot')).records.length, before.records.length);
    await page.evaluate(choice => { window.__draftNative.dialogChoice = choice; }, await label('giveUp'));
    await api('failNextRender');
    await dialog().getByRole('button', { name: await label('draftRestore'), exact: true }).click();
    await page.waitForFunction(() => window.__draftTest.snapshot().error === 'draftRestoreFailed');
    state = await api('snapshot');
    assert.deepEqual(state.documentJSON, before.documentJSON);
    assert.equal(state.filepath, before.filepath);
    assert.equal(state.isSave, before.isSave);
    assert.equal(state.rendering, false);
    assert.ok(state.records.some(draft => draft.markdown.includes('Do not lose this document')), 'Failed recovery re-protects the previous dirty document after guard discard');
    await api('refresh');
    assert.equal((await api('snapshot')).recoverable.length, 1, 'Claimed render failures remain reviewable in this window');
    await dialog().getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__draftTest.snapshot().error === null && !window.__draftTest.snapshot().visible);
    assert.equal((await api('snapshot')).sourcePath, 'C:\\notes\\original.md');
    record('Cancel preserves the current document; failed restore rolls it back, re-protects its discarded draft and retries the separate claimed draft');

    await api('fixture', { markdown: '# Failure test\n\nLatest text\n', dirty: true });
    await page.evaluate(() => { window.__draftNative.failWrite = true; });
    await api('edit', 'New edit');
    assert.equal((await api('snapshot')).error, 'draftSaveFailed');
    await page.getByText(await label('draftSaveFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__draftNative.failWrite = false; });
    await page.locator('.draft-recovery-notice').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__draftTest.snapshot().error === null);
    assert.ok((await api('snapshot')).records.some(draft => draft.markdown.includes('New edit')));
    await page.evaluate(() => { window.__draftNative.failRemove = true; });
    await api('save');
    state = await api('snapshot');
    assert.equal(state.isSave, true);
    assert.equal(state.cleanupPending, true);
    assert.equal(state.error, 'draftDiscardFailed');
    await page.evaluate(() => { window.__draftNative.failRemove = false; });
    await page.locator('.draft-recovery-notice').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => !window.__draftTest.snapshot().cleanupPending);
    record('Storage failure preserves editor content and retries; failed cleanup reports a retained draft without misreporting a successful file save');

    const large = '# Large heading\r\n\r\n'.concat('Untouched body with **formatting**.\r\n\r\n'.repeat(16_000));
    await api('fixture', { markdown: '# Before large\n', path: 'C:\\notes\\before-large.md', dirty: false, autoSave: true });
    await api('seed', { id: idB, title: 'large.md', sourcePath: 'C:\\notes\\large.md', markdown: large });
    const contender = await context.newPage();
    await contender.goto(url);
    await contender.waitForFunction(() => window.__draftTest?.snapshot().ready);
    await contender.evaluate(() => window.__draftTest.fixture({ markdown: '# Contender\n\nPreserve my old draft\n', dirty: true }));
    await contender.evaluate(choice => { window.__draftNative.dialogChoice = choice; }, await label('giveUp'));
    const contenderBefore = await contender.evaluate(() => window.__draftTest.snapshot().documentJSON);
    await page.getByRole('button', { name: await label('draftReview'), exact: true }).click();
    await page.evaluate(() => { window.__draftNative.calls.length = 0; });
    await dialog().getByRole('button', { name: await label('draftRestore'), exact: true }).click();
    await page.waitForFunction(() => !window.__draftTest.snapshot().visible);
    await page.waitForTimeout(750);
    state = await api('snapshot');
    assert.equal(state.segmented, true);
    assert.ok(state.segmentCount > 1);
    assert.equal(state.markdown, large);
    assert.equal(state.filepath, null);
    assert.equal(state.isSave, false);
    assert.equal(state.sourcePath, 'C:\\notes\\large.md');
    assert.equal(await page.evaluate(() => window.__draftNative.calls.filter(call => call.command === 'save_md').length), 0);
    await api('capture');
    assert.ok((await api('snapshot')).records.some(draft => draft.markdown === large));
    await contender.evaluate(id => window.__draftTest.restore(id), idB);
    assert.equal(await contender.evaluate(() => window.__draftTest.snapshot().error), 'draftRestoreFailed');
    assert.deepEqual(await contender.evaluate(() => window.__draftTest.snapshot().documentJSON), contenderBefore);
    assert.ok(await contender.evaluate(() => window.__draftTest.snapshot().records.some(draft => draft.markdown.includes('Preserve my old draft'))), 'Claim failure re-protects its previous dirty draft');
    await contender.evaluate(() => window.__draftTest.clear());
    await contender.close();
    record('Large-file recovery and subsequent draft capture retain every segment and CRLF without writing the original file');
    record('A second window cannot claim an already recovered draft or replace its own document with a stale selection');

    await api('fixture', { markdown: '# Race\n\nOriginal\n', dirty: true });
    await api('prepareDeleteRace');
    await api('save');
    await page.waitForFunction(() => window.__draftTest.snapshot().records.some(draft => draft.markdown.includes('Edit during cleanup')));
    assert.equal((await api('snapshot')).isSave, false);
    record('An edit made during draft cleanup receives a new draft instead of being deleted with the saved revision');

    await api('fixture', { markdown: '# Leave clean\n', dirty: false });
    await api('locale', 'zhCn');
    await api('theme', 'dark');
    await api('seed', { id: idA, title: '本地草稿.md', markdown: '# 待恢复\n', updatedAt: Date.now() });
    await page.getByRole('button', { name: await label('draftReview'), exact: true }).click();
    await page.setViewportSize({ width: 390, height: 640 });
    await dialog().getByRole('button', { name: await label('draftDiscard'), exact: true }).click();
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
    await page.screenshot({ path: path.join(screenshots, 'draft-recovery-chinese-dark.png') });
    await dialog().getByRole('button', { name: await label('cancel'), exact: true }).click();
    assert.ok((await api('snapshot')).records.some(draft => draft.id === idA));
    await dialog().getByRole('button', { name: await label('draftDiscard'), exact: true }).click();
    await dialog().getByRole('button', { name: await label('draftDiscardAction'), exact: true }).click();
    await page.waitForFunction(id => !window.__draftTest.snapshot().pending && !window.__draftTest.snapshot().records.some(draft => draft.id === id), idA);
    const afterDiscard = await api('snapshot');
    assert.equal(afterDiscard.visible, false, JSON.stringify({ recoverable: afterDiscard.recoverable,
      records: afterDiscard.records.map(draft => ({ id: draft.id, title: draft.title, owner: draft.owner, start: draft.markdown.slice(0, 80) })) }));
    assert.equal(await second.evaluate(() => window.__draftTest.snapshot().records.length), 1);
    record('Chinese dark-theme narrow-screen discard uses a cancelable confirmation and deletes only the selected inactive draft');
    await second.close();
    const registrationContext = await browser.newContext();
    await registrationContext.addInitScript(nativeMock);
    await registrationContext.addInitScript(() => { window.__draftNative.failOwner = true; });
    const registrationPage = await registrationContext.newPage();
    await registrationPage.goto(url);
    await registrationPage.waitForFunction(() => window.__draftTest?.snapshot().error === 'draftLoadFailed');
    await registrationPage.evaluate(() => { window.__draftNative.failOwner = false; });
    await registrationPage.getByRole('button', { name: await registrationPage.evaluate(() => window.__draftTest.translate('retry')), exact: true }).click();
    await registrationPage.waitForFunction(() => window.__draftTest.snapshot().ready && window.__draftTest.snapshot().error === null);
    await registrationContext.close();
    record('Failed initial owner registration releases its lifetime Web Lock so Retry completes successfully');
    assert.deepEqual(errors, []);
    console.log('Draft recovery browser checks passed');
  } finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.httpServer.close(resolve));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) === root && path.basename(resolved).startsWith('.draft-recovery-browser-test-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
