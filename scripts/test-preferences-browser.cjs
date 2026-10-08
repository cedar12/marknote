/*
 * Real-browser checks for Markdown preferences and theme management.
 * Run: node scripts/test-preferences-browser.cjs
 * Optional: MARKNOTE_PLAYWRIGHT_PATH, MARKNOTE_BROWSER_PATH,
 * MARKNOTE_PREFERENCES_SCREENSHOT_DIR. Clipboard and native IPC are
 * simulated; Preferences, Markdown, Theme, their stores, and the editor
 * use the real implementation.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required. Install it or set MARKNOTE_PLAYWRIGHT_PATH.');
}

function browserOptions(chromium) {
  if (process.env.MARKNOTE_BROWSER_PATH) return { executablePath: process.env.MARKNOTE_BROWSER_PATH };
  if (fs.existsSync(chromium.executablePath())) return {};
  const executablePath = [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find(candidate => fs.existsSync(candidate));
  if (!executablePath) throw new Error('Install a Playwright Chromium browser or set MARKNOTE_BROWSER_PATH.');
  return { executablePath };
}

const harness = String.raw`<template>
  <Preferences />
  <div id="test-runtime-editor" hidden><EditorContent :editor="editor" /></div>
</template>
<script setup>
import { nextTick, watch, onBeforeUnmount } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { closeHistory } from '@tiptap/pm/history';
import { createEditor } from '/src/utils/editor';
import { pasteFromClipboard } from '/src/utils/clipboard';
import { usePreferencesStore } from '/src/store/preferences';
import { useEditorStore } from '/src/store/editor';
import { useAppStore } from '/src/store/app';
import themes from '/src/theme';
import i18n from '/src/i18n';
import Preferences from '/src/components/Preferences.vue';

const preferences = usePreferencesStore();
const editorStore = useEditorStore();
const app = useAppStore();
const editor = createEditor();
watch(editor, value => { if (value) editorStore.setEditor(value); }, { immediate: true });
window.__preferencesTest = {
  async setLocale(locale) { i18n.global.locale.value = locale; await nextTick(); },
  translate(key) { return i18n.global.t(key); },
  snapshot() {
    return {
      markdown: { ...preferences.markdown },
      loadingMarkdown: preferences.loadingMarkdown,
      savingMarkdown: preferences.savingMarkdown,
      markdownLoaded: preferences.markdownLoaded,
      options: editor.value ? { ...editor.value.storage.markdown.options } : null,
      theme: app.theme ? { ...app.theme } : null,
      themes: themes.map(item => ({ ...item })),
      document: editor.value?.getJSON(),
      selection: editor.value ? { from: editor.value.state.selection.from, to: editor.value.state.selection.to } : null,
      headings: editorStore.headings.map(item => ({ ...item })),
      segmentIndex: editorStore.segmentIndex,
      selectedHeading: editor.value?.state.selection.$from.parent.type.name === 'heading' ? editor.value.state.selection.$from.parent.textContent : null,
    };
  },
  render(markdown) { return editor.value.storage.markdown.parser.md.render(markdown); },
  parse(markdown) { return editor.value.storage.markdown.parser.parse(markdown); },
  clipboard({ kind, text, plainText = false }) {
    const props = editor.value.state.plugins.find(plugin => plugin.key.startsWith('markdownClipboard')).props;
    if (kind === 'paste') return props.clipboardTextParser(text, editor.value.state.selection.$from, plainText)?.toJSON() || null;
    return props.clipboardTextSerializer(editor.value.state.doc.slice(0, editor.value.state.doc.content.size)) || null;
  },
  async setContent(markdown) { editor.value.commands.setContent(markdown); editor.value.commands.setTextSelection(2); await nextTick(); },
  async clearContent() { editor.value.commands.setContent(''); editor.value.commands.setTextSelection(1); await nextTick(); },
  async select(position) { editor.value.commands.setTextSelection(position); await nextTick(); },
  async pasteFromClipboard() { const result = await pasteFromClipboard(editor.value); await nextTick(); return result; },
  async pastePlainText(text) {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    const result = editor.value.view.pasteText(text, event);
    await nextTick();
    return result;
  },
  async segmentedFixture() {
    const local = '# Local Current\n\nOriginal paragraph\n\n';
    editor.value.commands.setContent(local);
    editorStore.segmented = true;
    editorStore.segments = [local, '<h2>Remote HTML title</h2>\n\n# Remote Markdown target\n\n'];
    editorStore.segmentIndex = 0;
    editorStore.segmentDirty = false;
    editorStore.segmentHeadings = [];
    editorStore.headings = [];
    editorStore.updateHeadings();
    const originalDocument = editor.value.getJSON();
    let paragraphPosition;
    editor.value.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph') paragraphPosition = pos; });
    editor.value.commands.setTextSelection(paragraphPosition + 1);
    editor.value.view.dispatch(closeHistory(editor.value.state.tr));
    editor.value.commands.insertContent('Edited ');
    editorStore.updateHeadings();
    editorStore.headings.find(heading => heading.segmentIndex === 0).status = 'close';
    await nextTick();
    return { originalDocument };
  },
  async undo() { const result = editor.value.commands.undo(); await nextTick(); editorStore.updateHeadings(); return result; },
  async navigate(text) { return editorStore.navigateToHeading(editorStore.headings.find(heading => heading.text === text)); },
  async resetSegments() {
    editorStore.segmented = false;
    editorStore.segments = [];
    editorStore.segmentHeadings = [];
    editorStore.headings = [];
    editorStore.segmentIndex = 0;
    editorStore.segmentDirty = false;
    editor.value.commands.setContent('');
    editorStore.updateHeadings();
    await nextTick();
  },
  serialize() { return editor.value.storage.markdown.getMarkdown(); },
  async save(patch) { await preferences.saveMarkdownPreferences(patch); await nextTick(); },
  async load() { preferences.markdownLoaded = false; await preferences.loadMarkdownPreferences(); await nextTick(); },
};
onBeforeUnmount(() => editorStore.setEditor(undefined));
</script>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; }
</style>`;

function nativeMock() {
  const defaults = { html: true, breaks: true, linkify: false, typographer: false, tightLists: true, bulletListMarker: '-', transformPastedText: false, transformCopiedText: false };
  const callbacks = new Map();
  const listeners = new Map();
  let nextId = 1;
  window.os = 'windows';
  window.isTauri = true;
  localStorage.setItem('lang', localStorage.getItem('lang') || 'en');
  const style = Object.fromEntries(['primaryBackgroundColor', 'primaryBackgroundColorHover', 'primaryBackgroundColorActive', 'primaryTextColor', 'primaryTextColorHover', 'primaryTextColorActive', 'primaryBorderColor', 'contentBackgroundColor', 'contentBackgroundColorActive', 'contentBackgroundColorHover', 'contentTextColor', 'contentTextColorActive', 'contentTextColorHover', 'contentBorderColor'].map(key => [key, key.includes('Text') ? '#222222' : '#eeeeee']));
  const theme = (label, value, type, source = 'installed') => ({ label, value, type, style: { ...style, contentBackgroundColor: type === 'dark' ? '#191919' : '#ffffff' }, source, removable: source === 'installed' });
  const state = {
    calls: [],
    markdown: JSON.parse(localStorage.getItem('__test_markdown_db') || JSON.stringify(defaults)),
    loadFailure: false,
    saveFailure: false,
    delayCommand: null,
    delayed: null,
    pick: null,
    confirm: true,
    themeFailure: null,
    themeListFailure: false,
    eventFailure: null,
    clipboardItems: [],
    clipboardReadFailure: false,
    clipboardDelay: false,
    nativeClipboard: '',
    nativeClipboardFailure: false,
    catalog: [theme('Bundled Forest', 'bundled-forest', 'light', 'bundled')],
    theme,
    async emit(event, payload) {
      for (const [id, listener] of listeners) if (listener.event === event) await callbacks.get(listener.handler)?.({ event, id, payload });
    },
    release() { if (this.delayed) { this.delayed(); this.delayed = null; } },
  };
  window.__nativeTest = state;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    async read() {
      if (state.clipboardDelay) {
        state.clipboardDelay = false;
        await new Promise(resolve => { state.delayed = resolve; });
      }
      if (state.clipboardReadFailure) throw new Error('Test browser clipboard failure');
      return state.clipboardItems.map(item => ({
        types: Object.keys(item),
        async getType(type) {
          if (item[type] === undefined) throw new Error('Clipboard MIME type unavailable');
          return new Blob([item[type]], { type });
        },
      }));
    },
  } });
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener(event, id) { listeners.delete(id); } };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'preferences' }, currentWebview: { label: 'preferences' } },
    transformCallback(callback, once = false) {
      const id = nextId++;
      callbacks.set(id, value => { if (once) callbacks.delete(id); return callback(value); });
      return id;
    },
    unregisterCallback(id) { callbacks.delete(id); },
    convertFileSrc(value) { return value; },
    async invoke(command, args = {}) {
      state.calls.push({ command, args: JSON.parse(JSON.stringify(args)) });
      if (state.delayCommand === command) {
        state.delayCommand = null;
        await new Promise(resolve => { state.delayed = resolve; });
      }
      if (command === 'plugin:event|listen') {
        const id = nextId++;
        listeners.set(id, { event: args.event, handler: args.handler });
        return id;
      }
      if (command === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
      if (command === 'plugin:event|emit' || command === 'plugin:event|emit_to') {
        if (state.eventFailure === args.event) throw new Error('Test cross-window event failure');
        await state.emit(args.event, args.payload);
        return;
      }
      if (command === 'get_config') return state.loadFailure ? { code: 1, info: 'Test database read failure' } : { code: 0, data: { markdown_preferences: JSON.stringify(state.markdown) } };
      if (command === 'render_markdown') return window.__preferencesTest.render(args.markdown);
      if (command === 'save_markdown_preferences') {
        if (state.saveFailure) return { code: 1, info: 'Test database write failure' };
        state.markdown = args.options;
        localStorage.setItem('__test_markdown_db', JSON.stringify(state.markdown));
        return { code: 0, info: '' };
      }
      if (command === 'plugin:dialog|open') return state.pick;
      if (command === 'plugin:dialog|confirm') return state.confirm;
      if (command === 'plugin:dialog|message') {
        const labels = args.buttons?.OkCancelCustom || ['Ok', 'Cancel'];
        return state.confirm ? labels[0] : labels[1];
      }
      if (command === 'plugin:clipboard-manager|read_text') {
        if (state.nativeClipboardFailure) throw new Error('Test native clipboard failure');
        return state.nativeClipboard;
      }
      if (command === 'plugin:notification|is_permission_granted') return true;
      if (command === 'plugin:notification|request_permission') return 'granted';
      if (command.startsWith('plugin:window|') || command.startsWith('plugin:log|') || command === 'log_error' || command === 'log_info') return;
      if (command === 'theme_list') {
        if (state.themeFailure === 'list' || state.themeListFailure) throw { code: 'io_error', message: 'Test theme list read failure' };
        return state.catalog.map(item => ({ ...item, style: { ...item.style } }));
      }
      if (command === 'theme_install') {
        if (state.themeFailure) throw { code: state.themeFailure, message: 'Test theme install failure' };
        if (args.path?.includes('invalid')) throw { code: 'invalid_theme', message: 'Test malformed JSON' };
        const installed = args.path?.includes('emoji')
          ? theme('🌙'.repeat(128), 'emoji-theme', 'light')
          : args.path?.includes('midnight') ? theme('Test Midnight', 'test-midnight', 'dark') : theme('Test Sunset', 'test-sunset', 'light');
        if (state.catalog.some(item => item.value === installed.value)) throw { code: 'duplicate_theme', message: 'Theme already exists' };
        state.catalog.push(installed);
        return installed;
      }
      if (command === 'theme_uninstall') {
        if (state.themeFailure) throw { code: state.themeFailure, message: 'Test theme remove failure' };
        const index = state.catalog.findIndex(item => item.value === args.value);
        if (index < 0) throw { code: 'theme_not_found', message: 'Theme no longer exists' };
        if (!state.catalog[index].removable) throw { code: 'builtin_theme', message: 'Bundled theme' };
        state.catalog.splice(index, 1);
        return;
      }
      throw new Error('Unexpected native command: ' + command);
    },
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.preferences-browser-test-'));
  let server;
  let browser;
  let page;
  const pageErrors = [];
  const passed = [];
  const screenshots = process.env.MARKNOTE_PREFERENCES_SCREENSHOT_DIR ? path.resolve(process.env.MARKNOTE_PREFERENCES_SCREENSHOT_DIR) : null;
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';",
      "import { createPinia } from 'pinia';",
      "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';",
      "import 'element-plus/theme-chalk/dark/css-vars.css';",
      "import '/src/styles.css';",
      "import Harness from './Harness.vue';",
      "const app = createApp(Harness);",
      "app.config.errorHandler = error => { console.error(error); window.__vueTestErrors ||= []; window.__vueTestErrors.push(String(error)); };",
      "app.use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Preferences browser test</title></head><body><div data-tauri-drag-region id="marknote-titlbar" class="marknote-titlbar"></div><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const stubId = '\0preferences-test-stub';
    const config = {
      root,
      configFile: false,
      plugins: [{ name: 'preferences-test-unrelated-tabs', enforce: 'pre', resolveId(source, importer) { if (importer?.replaceAll('\\', '/').endsWith('/src/components/Preferences.vue') && /^\.\/preferences\/(General|Editor|Image)\.vue$/.test(source)) return stubId; }, load(id) { if (id === stubId) return "export default { template: '<div data-unrelated-settings-stub></div>' };"; } }, vue()],
      build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } },
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
      logLevel: 'error',
    };
    console.log('Building isolated preferences browser harness');
    await build(config);
    server = await preview(config);
    const port = server.httpServer.address().port;
    const url = `http://127.0.0.1:${port}/${path.basename(temporary)}/index.html`;
    console.log(`Preferences browser harness: ${url}`);
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    page = await browser.newPage({ viewport: { width: 1100, height: 780 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => { pageErrors.push(error.message); console.error(`Page error: ${error.message}`); });
    page.on('console', message => { if (message.type() === 'error') console.error(`Browser: ${message.text()}`); });
    await page.addInitScript(nativeMock);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__preferencesTest?.snapshot().options));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__preferencesTest[method](argument), { method, argument });
    const native = patch => page.evaluate(patch => Object.assign(window.__nativeTest, patch), patch);
    const calls = command => page.evaluate(command => window.__nativeTest.calls.filter(call => call.command === command), command);
    const record = description => { passed.push(description); console.log(`PASS ${description}`); };
    const label = key => api('translate', key);
    const tab = async key => page.locator('.preferences-router').getByRole('button', { name: await label(key), exact: true }).click();

    // Component-specific assertions are kept below the harness setup.
    await tab('markdown');
    await page.locator('.preferences-markdown-options').waitFor();
    await page.waitForFunction(() => window.__preferencesTest.snapshot().markdownLoaded);
    assert.notEqual(await label('markdownBreaks'), 'markdownBreaks', 'English Markdown controls must have translated labels');
    record('Markdown tab mounts the actual preferences component and loads persisted options');

    const markdownSwitch = key => page.locator(`#markdown-${key}`);
    const setSwitch = async (key, value) => {
      if ((await markdownSwitch(key).getAttribute('aria-checked')) !== String(value)) await markdownSwitch(key).locator('..').click();
      await page.waitForFunction(({ key, value }) => !window.__preferencesTest.snapshot().savingMarkdown && window.__preferencesTest.snapshot().markdown[key] === value, { key, value });
    };
    const initial = (await api('snapshot')).markdown;
    assert.deepEqual(initial, { html: true, breaks: true, linkify: false, typographer: false, tightLists: true, bulletListMarker: '-', transformPastedText: false, transformCopiedText: false });
    assert.equal(await page.locator('.preferences-markdown-options [role="switch"]').count(), 7);
    const optionLabels = { html: 'markdownHtml', breaks: 'markdownBreaks', linkify: 'markdownLinkify', typographer: 'markdownTypographer', tightLists: 'markdownTightLists', transformPastedText: 'markdownPaste', transformCopiedText: 'markdownCopy' };
    for (const [key, localeKey] of Object.entries(optionLabels)) {
      const control = page.getByRole('switch', { name: await label(localeKey), exact: true });
      assert.equal(await control.getAttribute('id'), `markdown-${key}`);
      assert.equal(await control.getAttribute('aria-describedby'), `markdown-${key}-hint`);
      assert.ok((await page.locator(`#markdown-${key}-hint`).textContent()).trim());
    }
    assert.equal(await page.getByRole('combobox', { name: await label('markdownBulletMarker'), exact: true }).getAttribute('id'), 'markdown-bullet-marker');
    record('all native switch inputs expose their labels and descriptions; the bullet marker combobox has an accessible name');
    await api('setContent', 'Preserve **this** document.');
    const preserved = await api('snapshot');

    await setSwitch('breaks', false);
    assert.ok(!(await api('render', 'first\nsecond')).includes('<br>'));
    await setSwitch('html', false);
    assert.ok((await api('render', '<span>Raw HTML</span>')).includes('&lt;span&gt;'));
    await setSwitch('linkify', true);
    assert.ok((await api('render', 'https://example.com')).includes('href="https://example.com"'));
    await setSwitch('typographer', true);
    assert.ok((await api('render', '(c) (tm)')).includes('©'));
    assert.ok((await api('render', '(c) (tm)')).includes('™'));
    await setSwitch('tightLists', false);
    await setSwitch('transformPastedText', true);
    await setSwitch('transformCopiedText', true);
    await page.locator('.markdown-marker .el-select').click();
    await page.getByRole('option', { name: await label('markdownBulletStar'), exact: true }).click();
    await page.waitForFunction(() => window.__preferencesTest.snapshot().markdown.bulletListMarker === '*' && !window.__preferencesTest.snapshot().savingMarkdown);
    const changed = await api('snapshot');
    assert.deepEqual(changed.document, preserved.document, 'preferences must preserve the open document');
    assert.deepEqual(changed.selection, preserved.selection, 'preferences must preserve the selection');
    for (const [key, value] of Object.entries(changed.markdown)) assert.equal(changed.options[key], value, `runtime Markdown option ${key}`);
    assert.deepEqual((await calls('save_markdown_preferences')).at(-1).args.options, changed.markdown);
    record('all eight settings save, update the actual parser, and preserve the open document and selection');

    await api('setContent', '- one\n- two');
    assert.match(await api('serialize'), /^\* one/m, 'bullet marker controls actual Markdown serialization');
    assert.match(await api('serialize'), /one\n\n\* two/, 'loose lists serialize with paragraph spacing');
    record('list spacing and bullet marker change actual Markdown output');

    const formattedPaste = await api('clipboard', { kind: 'paste', text: '**Paste bold**' });
    assert.ok(JSON.stringify(formattedPaste).includes('"type":"bold"'));
    assert.equal(await api('clipboard', { kind: 'paste', text: '**Paste bold**', plainText: true }), null, 'plain text paste should bypass Markdown formatting');
    await setSwitch('transformPastedText', false);
    assert.equal(await api('clipboard', { kind: 'paste', text: '**Paste bold**' }), null);
    await setSwitch('transformPastedText', true);
    await api('setContent', '**Copy bold**');
    assert.match(await api('clipboard', { kind: 'copy' }), /\*\*Copy bold\*\*/);
    await setSwitch('transformCopiedText', false);
    assert.equal(await api('clipboard', { kind: 'copy' }), null);
    await setSwitch('transformCopiedText', true);
    record('copy and paste settings update the live clipboard plugin; plain text paste still bypasses formatting');

    await api('clearContent');
    assert.equal(await api('pastePlainText', '**Plain bold** and $x^2$'), true);
    const explicitPlainPaste = JSON.stringify((await api('snapshot')).document);
    assert.ok(explicitPlainPaste.includes('**Plain bold** and $x^2$'), explicitPlainPaste);
    assert.ok(!explicitPlainPaste.includes('"type":"bold"'));
    assert.ok(!explicitPlainPaste.includes('"type":"inlineKatex"'));
    record('explicit plain text paste bypasses both Markdown parsing and Tiptap bold and math paste rules');

    await native({ clipboardItems: [{ 'text/plain': '**Menu bold** and $x^2$' }] });
    await api('clearContent');
    assert.equal(await api('pasteFromClipboard'), true);
    assert.ok(JSON.stringify((await api('snapshot')).document).includes('"type":"bold"'));
    assert.ok(JSON.stringify((await api('snapshot')).document).includes('"type":"inlineKatex"'));
    await setSwitch('transformPastedText', false);
    await api('clearContent');
    assert.equal(await api('pasteFromClipboard'), true);
    const plainMenuPaste = JSON.stringify((await api('snapshot')).document);
    assert.ok(plainMenuPaste.includes('**Menu bold** and $x^2$'), plainMenuPaste);
    assert.ok(!plainMenuPaste.includes('"type":"bold"'));
    assert.ok(!plainMenuPaste.includes('"type":"inlineKatex"'));
    await native({ clipboardItems: [{ 'text/html': '<p><strong>Rich clipboard</strong></p>', 'text/plain': 'Rich clipboard' }] });
    await api('clearContent');
    assert.equal(await api('pasteFromClipboard'), true);
    assert.ok(JSON.stringify((await api('snapshot')).document).includes('"type":"bold"'), 'rich HTML paste must keep its formatting');
    await setSwitch('transformPastedText', true);
    await native({ clipboardReadFailure: true, nativeClipboard: '**Native fallback**' });
    await api('clearContent');
    assert.equal(await api('pasteFromClipboard'), true);
    assert.ok(JSON.stringify((await api('snapshot')).document).includes('"type":"bold"'));
    await native({ nativeClipboardFailure: true });
    await api('setContent', 'Keep **this selection**');
    const clipboardFailureBefore = await api('snapshot');
    assert.equal(await api('pasteFromClipboard'), false);
    assert.deepEqual((await api('snapshot')).document, clipboardFailureBefore.document);
    assert.deepEqual((await api('snapshot')).selection, clipboardFailureBefore.selection);
    await native({ clipboardItems: [], clipboardReadFailure: false, nativeClipboardFailure: false, nativeClipboard: '' });
    const emptyClipboardBefore = await api('snapshot');
    const dialogsBeforeEmpty = (await calls('plugin:dialog|message')).length;
    for (const clipboardItems of [[], [{ 'text/plain': '' }], [{ 'image/png': 'unsupported image content' }]]) {
      await native({ clipboardItems });
      assert.equal(await api('pasteFromClipboard'), false);
      assert.deepEqual((await api('snapshot')).document, emptyClipboardBefore.document);
      assert.deepEqual((await api('snapshot')).selection, emptyClipboardBefore.selection);
      assert.equal((await calls('plugin:dialog|message')).length, dialogsBeforeEmpty);
    }
    record('menu and context-menu paste helper honors Markdown text settings, retains rich HTML, falls back to native clipboard, and preserves selection on failure');

    await api('setContent', 'start end');
    await native({ clipboardItems: [{ 'text/plain': 'PASTE' }], clipboardDelay: true });
    const delayedPaste = api('pasteFromClipboard');
    await page.waitForFunction(() => Boolean(window.__nativeTest.delayed));
    await api('select', 7);
    await page.evaluate(() => window.__nativeTest.release());
    assert.equal(await delayedPaste, true);
    assert.equal(await api('serialize'), 'sPASTEtart end', 'an asynchronous paste should restore its original selection');
    await api('setContent', 'Keep original');
    await native({ clipboardDelay: true });
    const cancelledPaste = api('pasteFromClipboard');
    await page.waitForFunction(() => Boolean(window.__nativeTest.delayed));
    await api('setContent', 'Edited during read');
    const documentChangedBeforeRelease = await api('snapshot');
    await page.evaluate(() => window.__nativeTest.release());
    assert.equal(await cancelledPaste, false);
    assert.deepEqual((await api('snapshot')).document, documentChangedBeforeRelease.document);
    assert.deepEqual((await api('snapshot')).selection, documentChangedBeforeRelease.selection);
    record('empty clipboard is a quiet no-op; delayed paste restores its range and cancels if the document changed');

    await setSwitch('html', true);
    const segmentFixture = await api('segmentedFixture');
    const segmentedBefore = await api('snapshot');
    assert.equal(segmentedBefore.headings.find(item => item.text === 'Remote Markdown target').headingIndex, 1);
    assert.equal(segmentedBefore.headings.find(item => item.text === 'Remote HTML title').headingIndex, 0);
    await setSwitch('html', false);
    const segmentedAfter = await api('snapshot');
    assert.deepEqual(segmentedAfter.document, segmentedBefore.document);
    assert.deepEqual(segmentedAfter.selection, segmentedBefore.selection);
    assert.equal(segmentedAfter.headings.find(item => item.segmentIndex === 0).status, 'close');
    assert.equal(segmentedAfter.headings.some(item => item.text === 'Remote HTML title'), false);
    assert.equal(segmentedAfter.headings.find(item => item.text === 'Remote Markdown target').headingIndex, 0);
    assert.equal(await api('undo'), true, 'preference changes must preserve undo history');
    assert.deepEqual((await api('snapshot')).document, segmentFixture.originalDocument);
    assert.equal(await api('navigate', 'Remote Markdown target'), true);
    assert.equal((await api('snapshot')).segmentIndex, 1);
    assert.equal((await api('snapshot')).selectedHeading, 'Remote Markdown target');
    await api('resetSegments');
    record('HTML preference changes rebuild unloaded segment headings and preserve current document, selection, undo, and collapse state before accurate cross-segment navigation');

    await native({ saveFailure: true });
    const beforeFailure = await api('snapshot');
    await markdownSwitch('linkify').locator('..').click();
    await page.getByRole('alert').filter({ hasText: await label('preferencesSaveFailed') }).waitFor();
    assert.deepEqual((await api('snapshot')).markdown, beforeFailure.markdown);
    assert.equal(await markdownSwitch('linkify').getAttribute('aria-checked'), 'true');
    assert.equal((await api('snapshot')).options.linkify, true);
    await native({ saveFailure: false });
    await page.getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => !window.__preferencesTest.snapshot().markdown.linkify && !window.__preferencesTest.snapshot().savingMarkdown);
    assert.equal(await page.locator('.markdown-error').count(), 0);
    record('a database write failure rolls back the switch and runtime; retry saves the failed change');

    const savesBeforeBusy = (await calls('save_markdown_preferences')).length;
    await native({ delayCommand: 'save_markdown_preferences' });
    await markdownSwitch('breaks').locator('..').click();
    await page.waitForFunction(() => window.__preferencesTest.snapshot().savingMarkdown);
    assert.equal(await page.locator('.preferences-markdown-options').getAttribute('aria-busy'), 'true');
    for (const key of Object.keys(initial).filter(key => key !== 'bulletListMarker')) assert.equal(await markdownSwitch(key).isDisabled(), true);
    await markdownSwitch('breaks').locator('..').dispatchEvent('click');
    await page.evaluate(() => window.__nativeTest.release());
    await page.waitForFunction(() => !window.__preferencesTest.snapshot().savingMarkdown);
    assert.equal((await calls('save_markdown_preferences')).length, savesBeforeBusy + 1);
    record('saving disables competing controls and issues a single database write');

    await native({ loadFailure: true });
    await api('load').then(() => assert.fail('load should fail'), error => assert.match(error.message, /database read failure/));
    await page.getByRole('alert').filter({ hasText: await label('preferencesLoadFailed') }).waitFor();
    assert.equal(await markdownSwitch('breaks').isDisabled(), true);
    await native({ loadFailure: false });
    await page.getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__preferencesTest.snapshot().markdownLoaded && !window.__preferencesTest.snapshot().loadingMarkdown);
    assert.equal(await page.locator('.markdown-error').count(), 0);
    record('database read failure prevents edits and provides a recoverable retry');

    await native({ eventFailure: 'markdownPreferences' });
    await setSwitch('html', true);
    await page.getByRole('alert').filter({ hasText: await label('preferencesSyncFailed') }).waitFor();
    assert.equal(await page.locator('.markdown-error').count(), 0);
    assert.equal((await api('snapshot')).markdown.html, true);
    assert.equal(await page.evaluate(() => window.__nativeTest.markdown.html), true);
    assert.equal((await api('snapshot')).options.html, true);
    await native({ eventFailure: null });
    await setSwitch('html', false);
    assert.equal(await page.locator('.markdown-sync-error').count(), 0);
    record('Markdown synchronization failure retains the saved settings and runtime while reporting a distinct sync error');

    const persisted = (await api('snapshot')).markdown;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__preferencesTest?.snapshot().options));
    const markdownTab = page.locator('.preferences-router').getByRole('button', { name: await label('markdown'), exact: true });
    await markdownTab.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__preferencesTest.snapshot().markdownLoaded);
    assert.deepEqual((await api('snapshot')).markdown, persisted);
    assert.equal(await markdownTab.getAttribute('aria-current'), 'page');
    record('persisted settings survive a new window and the Markdown tab opens from the keyboard');

    await api('setLocale', 'zhCn');
    assert.match(await label('markdownBreaks'), /\p{Script=Han}/u, 'Chinese Markdown controls must have translated labels');
    assert.equal(await page.locator('#markdown-breaks-label').textContent(), await label('markdownBreaks'));
    await page.setViewportSize({ width: 560, height: 620 });
    await page.locator('.markdown-marker .el-select').scrollIntoViewIfNeeded();
    await page.locator('.markdown-marker .el-select').click();
    await page.getByRole('option', { name: await label('markdownBulletPlus'), exact: true }).waitFor();
    assert.ok(await page.getByRole('option', { name: await label('markdownBulletPlus'), exact: true }).isVisible());
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(screenshots, 'markdown-narrow-select.png') });
    }
    await page.keyboard.press('Escape');
    const markdownGeometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(markdownGeometry.width <= markdownGeometry.viewport + 1, 'Markdown settings should fit a narrow window');
    record('Chinese labels, scrollable narrow layout, and teleported list marker popup remain usable');
    await page.setViewportSize({ width: 1100, height: 780 });
    await api('setLocale', 'en');

    await tab('theme');
    const themePanel = page.locator('.preferences-theme');
    const themeToolbar = themePanel.locator('.theme-toolbar');
    const installButton = () => themeToolbar.getByRole('button', { name: /./ }).first();
    const refreshButton = () => themeToolbar.getByRole('button', { name: /./ }).nth(1);
    const card = name => themePanel.locator('.theme-item').filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });
    const idleThemes = () => page.waitForFunction(() => document.querySelector('.preferences-theme')?.getAttribute('aria-busy') === 'false');
    await idleThemes();
    assert.equal(await themePanel.locator('.theme-item').count(), 3);
    for (const protectedName of [await label('themeLight'), await label('themeDark'), 'Bundled Forest']) {
      assert.equal(await card(protectedName).locator('.theme-item-actions button').count(), 0);
    }
    record('theme catalog includes built-in and bundled themes without uninstall actions');

    const beforeCancelInstall = (await calls('theme_install')).length;
    await native({ pick: null });
    await installButton().click();
    await idleThemes();
    assert.equal((await calls('theme_install')).length, beforeCancelInstall);
    assert.equal(await themePanel.locator('.theme-error').count(), 0);
    const picker = (await calls('plugin:dialog|open')).at(-1).args.options;
    assert.equal(picker.multiple, false);
    assert.equal(picker.directory, false);
    assert.deepEqual(picker.filters[0].extensions, ['json']);
    record('JSON file picker is scoped to a single file; cancelling leaves the catalog unchanged');

    await native({ pick: 'C:\\fixtures\\sunset.json' });
    await installButton().click();
    await card('Test Sunset').waitFor();
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'light', 'installation does not implicitly change the active theme');
    assert.equal(await card('Test Sunset').locator('.theme-item-actions button').count(), 1);
    const selectSunset = card('Test Sunset').locator('.theme-select');
    await selectSunset.focus();
    await page.keyboard.press('Enter');
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'test-sunset');
    assert.equal(await selectSunset.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('theme')).value), 'test-sunset');
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('light')));
    record('successful theme installation refreshes the catalog and supports keyboard selection and persisted styling');

    await installButton().click();
    await idleThemes();
    await themePanel.getByRole('alert').filter({ hasText: await label('themeDuplicate') }).waitFor();
    assert.equal(await card('Test Sunset').count(), 1);
    assert.equal((await api('snapshot')).theme.value, 'test-sunset');
    await native({ pick: 'C:\\fixtures\\invalid.json' });
    await installButton().click();
    await idleThemes();
    await themePanel.getByRole('alert').filter({ hasText: await label('themeInvalidFile') }).waitFor();
    await native({ pick: 'C:\\fixtures\\other.json', themeFailure: 'io_error' });
    await installButton().click();
    await idleThemes();
    await themePanel.getByRole('alert').filter({ hasText: await label('themeFileFailed') }).waitFor();
    assert.equal(await themePanel.locator('.theme-item').count(), 4);
    await native({ themeFailure: null });
    record('duplicate, malformed, and filesystem failure errors preserve the catalog and current theme');

    await native({ themeFailure: 'list' });
    await refreshButton().click();
    await idleThemes();
    assert.equal(await themePanel.locator('.theme-item').count(), 4);
    await themePanel.getByRole('button', { name: await label('retry'), exact: true }).waitFor();
    await native({ themeFailure: null });
    await themePanel.getByRole('button', { name: await label('retry'), exact: true }).click();
    await idleThemes();
    assert.equal(await themePanel.locator('.theme-error').count(), 0);
    record('refresh read failures retain the last valid catalog and expose a successful retry');

    await native({ confirm: false });
    const beforeCancelRemove = (await calls('theme_uninstall')).length;
    await card('Test Sunset').locator('.theme-item-actions button').click();
    await idleThemes();
    assert.equal((await calls('theme_uninstall')).length, beforeCancelRemove);
    assert.equal(await card('Test Sunset').count(), 1);
    assert.equal((await api('snapshot')).theme.value, 'test-sunset');
    await native({ confirm: true, themeFailure: 'io_error' });
    await card('Test Sunset').locator('.theme-item-actions button').click();
    await idleThemes();
    await themePanel.getByRole('alert').filter({ hasText: await label('themeFileFailed') }).waitFor();
    assert.equal(await card('Test Sunset').count(), 1);
    assert.equal((await api('snapshot')).theme.value, 'test-sunset');
    await native({ themeFailure: null });
    await card('Test Sunset').locator('.theme-item-actions button').click();
    await idleThemes();
    assert.equal(await card('Test Sunset').count(), 0);
    assert.equal((await api('snapshot')).theme.value, 'light');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('theme')).value), 'light');
    await page.waitForFunction(() => document.activeElement?.matches('.theme-select.active'));
    record('uninstall confirmation cancellation and failure preserve the theme; removing the active light theme falls back to Light');

    const installsBeforeBusy = (await calls('theme_install')).length;
    await native({ pick: 'C:\\fixtures\\midnight.json', delayCommand: 'theme_install' });
    await installButton().click();
    await page.waitForFunction(() => Boolean(window.__nativeTest.delayed));
    assert.equal(await themePanel.getAttribute('aria-busy'), 'true');
    assert.equal(await installButton().isDisabled(), true);
    assert.equal(await refreshButton().isDisabled(), true);
    assert.equal(await card('Light').locator('.theme-select').isDisabled(), true);
    await installButton().dispatchEvent('click');
    await page.evaluate(() => window.__nativeTest.release());
    await idleThemes();
    assert.equal((await calls('theme_install')).length, installsBeforeBusy + 1);
    await card('Test Midnight').locator('.theme-select').click();
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'test-midnight');
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')));
    await card('Test Midnight').locator('.theme-item-actions button').click();
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'dark');
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')));
    await page.waitForFunction(() => document.activeElement?.matches('.theme-select.active'));
    record('busy theme operations prevent competing actions and removing an active dark theme falls back to Dark');

    await native({ pick: 'C:\\fixtures\\sunset.json', themeListFailure: true });
    await installButton().click();
    await idleThemes();
    assert.equal(await card('Test Sunset').count(), 1, 'successful installation should remain visible when the following list read fails');
    assert.ok((await themePanel.locator('.theme-status').textContent()).includes('Test Sunset'));
    await themePanel.getByRole('alert').filter({ hasText: await label('themeRefreshFailed') }).waitFor();
    await native({ themeListFailure: false });
    await themePanel.getByRole('button', { name: await label('retry'), exact: true }).click();
    await idleThemes();
    await card('Test Sunset').locator('.theme-select').click();
    await idleThemes();
    await native({ themeListFailure: true });
    await card('Test Sunset').locator('.theme-item-actions button').click();
    await idleThemes();
    assert.equal(await card('Test Sunset').count(), 0, 'successful removal should stay removed when the following list read fails');
    assert.equal((await api('snapshot')).theme.value, 'light');
    assert.ok((await themePanel.locator('.theme-status').textContent()).includes('Test Sunset'));
    await themePanel.getByRole('alert').filter({ hasText: await label('themeRefreshFailed') }).waitFor();
    await native({ themeListFailure: false });
    await themePanel.getByRole('button', { name: await label('retry'), exact: true }).click();
    await idleThemes();
    assert.equal(await themePanel.locator('.theme-error').count(), 0);
    record('install and uninstall results remain accurate after a subsequent list read fails, with a recoverable refresh retry');

    await native({ eventFailure: 'theme' });
    await card('Dark').locator('.theme-select').click();
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'dark');
    await themePanel.getByRole('alert').filter({ hasText: await label('themeSyncFailed') }).waitFor();
    await native({ eventFailure: 'themeCatalogChanged' });
    await refreshButton().click();
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'dark');
    await themePanel.getByRole('alert').filter({ hasText: await label('themeSyncFailed') }).waitFor();
    await native({ eventFailure: null });
    await card('Light').locator('.theme-select').click();
    await idleThemes();
    assert.equal(await themePanel.locator('.theme-error').count(), 0);
    record('theme and catalog synchronization failures report an error while retaining local selection and the valid catalog');

    await page.evaluate(async () => {
      const external = window.__nativeTest.theme('External Theme', 'external-theme', 'light');
      window.__nativeTest.catalog.push(external);
      await window.__nativeTest.emit('themeCatalogChanged', window.__nativeTest.catalog);
      await window.__nativeTest.emit('theme', external);
    });
    await card('External Theme').waitFor();
    assert.equal((await api('snapshot')).theme.value, 'external-theme');
    await page.evaluate(() => { window.__nativeTest.catalog = window.__nativeTest.catalog.filter(item => item.value !== 'external-theme'); });
    await refreshButton().click();
    await idleThemes();
    assert.equal(await card('External Theme').count(), 0);
    assert.equal((await api('snapshot')).theme.value, 'light');
    record('external catalog and theme events synchronize the open window; refreshing a removed active theme restores Light');

    const unicodeThemeLabel = '🌙'.repeat(128);
    await native({ pick: 'C:\\fixtures\\emoji.json' });
    await installButton().click();
    await idleThemes();
    await card(unicodeThemeLabel).waitFor();
    assert.equal((await api('snapshot')).themes.find(item => item.value === 'emoji-theme').label, unicodeThemeLabel);
    await card(unicodeThemeLabel).locator('.theme-select').click();
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'emoji-theme');
    await card(unicodeThemeLabel).locator('.theme-item-actions button').click();
    await idleThemes();
    assert.equal(await card(unicodeThemeLabel).count(), 0);
    assert.equal((await api('snapshot')).theme.value, 'light');
    await page.waitForFunction(() => document.activeElement?.matches('.theme-select.active'));
    record('a valid 128-character emoji theme installs and removes; uninstall restores keyboard focus to the active theme');

    await api('setLocale', 'zhCn');
    assert.match(await label('installThemeFile'), /\p{Script=Han}/u, 'Chinese theme actions must have translated labels');
    await page.setViewportSize({ width: 560, height: 620 });
    assert.equal(await installButton().textContent(), await label('installThemeFile'));
    await card(await label('themeDark')).locator('.theme-select').focus();
    await page.keyboard.press('Space');
    await idleThemes();
    assert.equal((await api('snapshot')).theme.value, 'dark');
    const autoSwitch = themePanel.locator('#auto-theme');
    await autoSwitch.locator('..').scrollIntoViewIfNeeded();
    await page.emulateMedia({ colorScheme: 'light' });
    await autoSwitch.locator('..').click();
    await idleThemes();
    assert.equal(await autoSwitch.getAttribute('aria-checked'), 'true');
    assert.equal((await api('snapshot')).theme.value, 'light');
    assert.equal(await page.evaluate(() => localStorage.getItem('autoTheme')), 'true');
    const themeGeometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(themeGeometry.width <= themeGeometry.viewport + 1, 'Theme settings should fit a narrow window');
    if (screenshots) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(screenshots, 'theme-narrow-chinese.png') });
    }
    record('Chinese theme labels, keyboard selection, narrow layout, and automatic system theme settings work');

    await page.evaluate(async () => {
      const next = { ...window.__preferencesTest.snapshot().markdown, linkify: true };
      await window.__nativeTest.emit('markdownPreferences', next);
    });
    assert.equal((await api('snapshot')).markdown.linkify, true);
    assert.equal((await api('snapshot')).options.linkify, true);
    assert.ok((await api('render', 'https://example.com')).includes('href="https://example.com"'));
    record('external Markdown preference events update the actual editor parser');

    assert.deepEqual(pageErrors, [], 'browser should not report uncaught errors');
    assert.deepEqual(await page.evaluate(() => window.__vueTestErrors || []), [], 'Vue should not report render or event errors');
    console.log(`preferences browser regression: ${passed.length} checks passed`);
  } catch (error) {
    console.error(`Preferences test failed after ${passed.length} checks:`, error);
    if (page && screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: path.join(screenshots, 'preferences-failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(screenshots, 'preferences-failure.html'), await page.content().catch(() => ''));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) === root && path.basename(resolved).startsWith('.preferences-browser-test-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
