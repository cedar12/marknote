const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Set MARKNOTE_PLAYWRIGHT_PATH.');
}
const harness = String.raw`<template><header><Statistics /></header><main class="el-scrollbar__wrap"><EditorContent :editor="editor" /></main></template>
<script setup>
import { nextTick } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import { TextSelection } from '@tiptap/pm/state';
import { DOMParser as PMParser } from '@tiptap/pm/model';
import { undoDepth, redoDepth } from '@tiptap/pm/history';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CharacterCount from '@tiptap/extension-character-count';
import { Heading } from '/src/extensions/heading';
import { Markdown } from '/src/extensions/markdown';
import { SearchAndReplace } from '/src/extensions/searchAndReplace';
import { useEditorStore } from '/src/store/editor';
import Statistics from '/src/components/titlebar/Statistics.vue';
import i18n from '/src/i18n';
const store = useEditorStore();
const editor = new Editor({ content: '', injectCSS: false,
  extensions: [StarterKit.configure({ heading: false }), Heading, Image.configure({ inline: true }), CharacterCount, Markdown, SearchAndReplace],
  onUpdate(event) { store.markCurrentSegmentEdited(); store.updateHeadings(event); store.updateCurrentStatistics(event.transaction); },
});
store.setEditor(editor);
const prototype = Object.getPrototypeOf(editor.state.doc);
const descendants = prototype.descendants;
let scans = 0;
prototype.descendants = function(callback) { scans++; return descendants.call(this, callback); };
window.__largeEditor = {
  async setContent(content) { await store.setContent(content); await nextTick(); },
  async showSegment(index) { const result = await store.showSegment(index); await nextTick(); return result; },
  async insert(text) { editor.view.dispatch(editor.state.tr.insertText(text, 200)); await nextTick(); },
  async insertAtEnd(text) { editor.view.dispatch(editor.state.tr.insertText(text, editor.state.doc.content.size - 1)); await nextTick(); },
  async selection(value) { editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, value.anchor, value.head))); editor.view.focus(); await nextTick(); },
  scroll(value) { document.querySelector('main').scrollTop = value; },
  undo() { return editor.commands.undo(); }, redo() { return editor.commands.redo(); },
  mapping(value) { store.setAttachmentMapping(value); },
  mappingEntries(value) { store.setAttachmentMapping(Object.fromEntries(value)); },
  parsingOptions(value) { editor.storage.markdown.parser.md.set(value); store.reindexOtherSegments(); },
  reindex() { store.reindexOtherSegments(); },
  async locale(value) { i18n.global.locale.value = value; await nextTick(); },
  translate(key) { return i18n.global.t(key); },
  currentCount() { return { characters: editor.storage.characterCount.characters(), words: editor.storage.characterCount.words() }; },
  expectedDocumentCount() {
    const markdown = store.getMarkdown();
    const html = editor.storage.markdown.parser.parse(markdown);
    const body = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
    const doc = PMParser.fromSchema(editor.schema).parse(body);
    return { characters: editor.storage.characterCount.characters({ node: doc }), words: editor.storage.characterCount.words({ node: doc }) };
  },
  headingEdit(text) {
    let position, heading;
    editor.state.doc.forEach((node, pos) => { if (!heading && node.type.name === 'heading') { heading = node; position = pos; } });
    scans = 0;
    editor.view.dispatch(editor.state.tr.insertText(text, position + 1, position + 1 + heading.content.size));
    return { scans, text: store.headings.find(item => item.segmentIndex === store.segmentIndex)?.text };
  },
  snapshot() { return { segmented: store.segmented, index: store.segmentIndex, text: editor.state.doc.textContent,
    segments: [...store.segments], markdown: store.getMarkdown(), scroll: document.querySelector('main').scrollTop,
    selection: { anchor: editor.state.selection.anchor, head: editor.state.selection.head }, undo: undoDepth(editor.state), redo: redoDepth(editor.state),
    cache: store.segmentCacheInfo(), current: { ...store.currentStatistics }, document: store.documentStatistics,
    pending: store.statisticsPending, mapping: { ...store.attachmentMapping }, mappingEntries: Object.entries(store.attachmentMapping), stateVersion: store.documentGeneration }; },
};
</script><style>
body{margin:0;font-family:sans-serif}header{height:32px;background:var(--primaryBackgroundColor);color:var(--primaryTextColor)}
main{height:560px;overflow:auto}.tiptap{padding:16px;overflow-wrap:anywhere}p{line-height:1.5}
</style>`;
async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.large-editor-browser-test-'));
  let server;
  let browser;
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), "import {createApp} from 'vue';import {createPinia} from 'pinia';import i18n from '/src/i18n';import 'element-plus/dist/index.css';import light from '/src/theme/style/light';import Harness from './Harness.vue';for(const [key,value] of Object.entries(light.style))document.documentElement.style.setProperty('--'+key,value);i18n.global.locale.value='en';createApp(Harness).use(createPinia()).use(i18n).mount('#test');");
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="test"></div><script type="module" src="./main.js"></script></body></html>');
    const config = { root, configFile: false, plugins: [vue()], logLevel: 'error', build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } }, preview: { host: '127.0.0.1', port: 0, strictPort: false } };
    await build(config);
    server = await preview(config);
    const executablePath = process.env.MARKNOTE_BROWSER_PATH || [chromium.executablePath(), path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find(candidate => fs.existsSync(candidate));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
    await page.addInitScript(() => { window.isTauri = false; window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, invoke: async () => undefined }; });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);
    await page.waitForFunction(() => Boolean(window.__largeEditor));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__largeEditor[method](argument), { method, argument });
    const source = Array.from({ length: 11 }, (_, index) => '# Segment ' + index + '\n\n' + ('segment ' + index + ' body ').repeat(11000) + '\n\n').join('');
    await api('setContent', source);
    const original = await api('snapshot');
    assert.equal(original.segmented, true);
    assert.equal(original.segments.length, 11, 'fixture produces eleven semantic segments at the actual size threshold');
    await api('insert', 'ROOT_EDIT ');
    await api('selection', { anchor: 250, head: 240 });
    await api('scroll', 2345);
    const first = await api('snapshot');
    await api('showSegment', 1);
    assert.equal((await api('snapshot')).undo, 0, 'an unopened segment starts with its own empty history');
    await api('insert', 'SECOND_EDIT ');
    await api('showSegment', 0);
    let returned = await api('snapshot');
    assert.deepEqual(returned.selection, first.selection, 'a cached segment preserves backward selection');
    assert.equal(returned.scroll, first.scroll, 'a cached segment restores its reading offset');
    assert.ok(returned.markdown.includes('ROOT_EDIT ') && returned.markdown.includes('SECOND_EDIT '), 'saving joins both edited segments');
    assert.deepEqual(returned.segments.slice(2), original.segments.slice(2), 'unopened source remains byte-for-byte');
    assert.equal(await api('undo'), true);
    assert.ok(!(await api('snapshot')).text.includes('ROOT_EDIT '));
    await api('showSegment', 1);
    assert.ok((await api('snapshot')).text.includes('SECOND_EDIT '));
    assert.equal(await api('undo'), true);
    await api('showSegment', 0);
    assert.equal((await api('snapshot')).redo, 1, 'redo survives visiting another segment');
    assert.equal(await api('redo'), true);
    assert.ok((await api('snapshot')).text.includes('ROOT_EDIT '));
    console.log('PASS cached per-segment undo/redo, backward selection, scroll and merged save');

    await page.waitForFunction(() => window.__largeEditor.snapshot().document !== null);
    assert.deepEqual((await api('snapshot')).current, await api('currentCount'));
    assert.deepEqual((await api('snapshot')).document, await api('expectedDocumentCount'), 'whole-document and current statistics use exactly the same PM text semantics');
    const statisticsTrigger = page.locator('.titlebar-words');
    await statisticsTrigger.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Current segment', exact: true }).click();
    await page.getByRole('button', { name: await api('translate', 'chars'), exact: true }).click();
    assert.equal(await statisticsTrigger.locator('span').first().textContent(), String((await api('snapshot')).current.characters));
    await page.keyboard.press('Escape');
    assert.equal(await statisticsTrigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await statisticsTrigger.evaluate(element => element === document.activeElement), true);
    await api('locale', 'zhCn');
    await statisticsTrigger.click();
    await page.getByRole('button', { name: '全文', exact: true }).click();
    assert.equal(await statisticsTrigger.locator('span').first().textContent(), String((await api('snapshot')).document.characters));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 360, height: 650 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'statistics controls fit a narrow viewport');
    await statisticsTrigger.click();
    await page.waitForFunction(() => {
      const popover = document.querySelector('.titlebar-words-popover');
      return popover && getComputedStyle(popover).opacity === '1';
    });
    const evidence = path.join(root, 'outputs', 'editor-performance');
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'statistics-chinese-narrow.png') });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1000, height: 650 });
    console.log('PASS complete/current statistics, real keyboard popup, scope switching and Chinese/narrow layout');

    const heading = await api('headingEdit', 'Renamed heading');
    assert.equal(heading.text, 'Renamed heading');
    assert.equal(heading.scans, 0, 'renaming a heading updates its indexed label without a full document scan');
    const beforeEviction = await api('snapshot');
    for (let index = 1; index < original.segments.length; index++) await api('showSegment', index);
    const evicted = await api('snapshot');
    assert.ok(evicted.cache.indexes.length <= evicted.cache.limit && evicted.cache.bytes <= evicted.cache.byteLimit);
    assert.ok(!evicted.cache.indexes.includes(0), 'older inactive state is evicted when the bounded cache is full');
    assert.ok(evicted.markdown.includes('ROOT_EDIT '), 'eviction never discards committed source');
    await api('showSegment', 0);
    returned = await api('snapshot');
    assert.equal(returned.undo, 0, 'an evicted state does not retain unbounded history');
    assert.ok(returned.text.includes('ROOT_EDIT '));
    assert.deepEqual(returned.selection, beforeEviction.selection, 'bookmarks survive state eviction');
    assert.equal(returned.scroll, beforeEviction.scroll);
    console.log('PASS incremental heading labels, bounded eviction and retained source/bookmarks');

    await api('setContent', '# A different document\n\nClean text');
    assert.equal((await api('snapshot')).cache.indexes.length, 0);
    assert.equal(await api('undo'), false, 'undo cannot cross a document transition');
    assert.ok(!(await api('snapshot')).markdown.includes('ROOT_EDIT '));
    await api('setContent', source);
    await api('setContent', 'Latest document');
    await page.waitForTimeout(80);
    assert.deepEqual((await api('snapshot')).document, await api('currentCount'), 'stale statistics jobs cannot overwrite the latest document');
    console.log('PASS document transitions release caches and cancel stale statistics');

    await api('setContent', '![local](old.png)\n\nBody');
    await api('insertAtEnd', ' edited');
    await api('mapping', { 'old.png': 'middle.png' });
    await api('mapping', { 'middle.png': 'new.png' });
    assert.equal((await api('snapshot')).mapping['old.png'], 'new.png');
    assert.ok((await api('snapshot')).markdown.includes('new.png'));
    assert.equal((await api('snapshot')).undo, 1, 'attachment aliases preserve the existing editing history');
    assert.equal(await api('undo'), true);
    assert.ok((await api('snapshot')).markdown.includes('new.png'), 'undoing text keeps attachment output pointed at the current directory');
    assert.equal(await api('redo'), true);
    await api('mapping', { 'new.png': 'old.png' });
    assert.ok(!(await api('snapshot')).mapping['old.png'], 'round-trip Save As removes identity aliases instead of making a cycle');
    assert.ok((await api('snapshot')).markdown.includes('old.png'));
    await api('setContent', '![prototype](__proto__)\n\n![constructor](constructor)');
    await api('mappingEntries', [['__proto__', 'prototype.png'], ['constructor', 'constructor.png']]);
    let aliases = await api('snapshot');
    assert.equal(new Map(aliases.mappingEntries).get('__proto__'), 'prototype.png', 'prototype-looking names remain own attachment keys');
    assert.equal(new Map(aliases.mappingEntries).get('constructor'), 'constructor.png');
    assert.ok(aliases.markdown.includes('prototype.png') && aliases.markdown.includes('constructor.png'));
    await api('mapping', { 'prototype.png': '__proto__' });
    aliases = await api('snapshot');
    assert.equal(new Map(aliases.mappingEntries).has('__proto__'), false, 'identity aliases are removed for prototype-looking names too');
    assert.match(aliases.markdown, /\]\(<?__proto__>?\)/, 'round-trip resource rewriting retains the actual destination with either valid Markdown delimiter');

    await api('parsingOptions', { html: false });
    await api('setContent', '<img src="old.png">\n\n' + source);
    await api('mapping', { 'old.png': 'new.png' });
    assert.ok((await api('snapshot')).markdown.startsWith('<img src="old.png">'), 'disabled HTML remains literal original source');
    await api('parsingOptions', { html: true });
    assert.ok((await api('snapshot')).markdown.startsWith('<img src="new.png">'), 'attachment memo is invalidated when HTML parsing changes');
    await api('parsingOptions', { html: false });
    assert.ok((await api('snapshot')).markdown.startsWith('<img src="old.png">'));
    console.log('PASS repeated attachment rebasing leaves editor state/history intact');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    console.log('large editor browser: 5 groups passed');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    if (path.dirname(path.resolve(temporary)) === root && path.basename(temporary).startsWith('.large-editor-browser-test-')) fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
