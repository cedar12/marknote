/* Actual ProseMirror and lowlight measurements. --baseline records the old path. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Set MARKNOTE_PLAYWRIGHT_PATH.');
}
const harness = String.raw`<template><main class="el-scrollbar__wrap"><EditorContent :editor="editor" /></main></template>
<script setup>
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { nextTick } from 'vue';
import { lowlight } from '/src/utils/lowlight';
import { CodeBlock } from '/src/extensions/codeBlock2';
import { Markdown } from '/src/extensions/markdown';
import { useEditorStore } from '/src/store/editor';
let counters = { highlight: 0, auto: 0, scans: 0, nodes: 0, highlightMs: 0 };
const measured = {
  listLanguages: () => lowlight.listLanguages(),
  registered: language => lowlight.registered(language),
  highlight(language, text) { const start = performance.now(); counters.highlight++; const result = lowlight.highlight(language, text); counters.highlightMs += performance.now() - start; return result; },
  highlightAuto(text, options) { const start = performance.now(); counters.auto++; const result = lowlight.highlightAuto(text, options); counters.highlightMs += performance.now() - start; return result; },
};
const store = useEditorStore();
const editor = new Editor({
  content: '', injectCSS: false,
  extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock.extend({ addNodeView() { return () => { const dom = document.createElement('pre'); const contentDOM = document.createElement('code'); dom.append(contentDOM); return { dom, contentDOM }; }; } }).configure({ lowlight: measured }), Markdown],
  onUpdate(event) { store.markCurrentSegmentEdited(); store.updateHeadings(event); store.updateCurrentStatistics?.(event.transaction); },
});
store.setEditor(editor);
const prototype = Object.getPrototypeOf(editor.state.doc);
const descendants = prototype.descendants;
prototype.descendants = function(callback) {
  counters.scans++;
  return descendants.call(this, (node, pos, parent, index) => { counters.nodes++; return callback(node, pos, parent, index); });
};
function reset() { counters = { highlight: 0, auto: 0, scans: 0, nodes: 0, highlightMs: 0 }; }
function result(start) { return { ...counters, elapsedMs: performance.now() - start }; }
window.__editorPerformance = {
  async unknown() {
    reset(); const start = performance.now();
    const source = 'const value = 42; // representative source\n'.repeat(3000).slice(0, 100000);
    await store.setContent('\x60\x60\x60unknown-language\n' + source + '\n\x60\x60\x60\n'); await nextTick();
    const load = result(start);
    reset(); const selected = performance.now(); editor.commands.setTextSelection(2); const selection = result(selected);
    reset(); const typed = performance.now(); editor.view.dispatch(editor.state.tr.insertText('x', 2)); const edit = result(typed);
    return { load, selection, edit, textLength: editor.state.doc.textContent.length };
  },
  async known() {
    await store.setContent('# Heading\n\nProse paragraph.\n\n' + Array.from({ length: 21 }, (_, index) => '\x60\x60\x60javascript\nconst value' + index + ' = 42;\n\x60\x60\x60\n\n').join(''));
    let codePosition; editor.state.doc.descendants((node, pos) => { if (codePosition === undefined && node.type.name === 'codeBlock') codePosition = pos; });
    editor.commands.setTextSelection(codePosition + 2);
    reset(); const typed = performance.now(); editor.view.dispatch(editor.state.tr.insertText('x', codePosition + 2)); const edit = result(typed);
    editor.commands.setTextSelection(12);
    reset(); const proseStart = performance.now(); editor.view.dispatch(editor.state.tr.insertText('x', 12)); const prose = result(proseStart);
    reset(); const selectionStart = performance.now(); editor.commands.setTextSelection(13); const selection = result(selectionStart);
    return { edit, prose, selection };
  },
};
</script><style>main{height:600px;overflow:auto}.tiptap{padding:16px}pre{white-space:pre-wrap}</style>`;
async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.editor-performance-test-'));
  let server;
  let browser;
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), "import {createApp} from 'vue';import {createPinia} from 'pinia';import Harness from './Harness.vue';createApp(Harness).use(createPinia()).mount('#test');");
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="test"></div><script type="module" src="./main.js"></script></body></html>');
    const config = { root, configFile: false, plugins: [vue()], logLevel: 'error', build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } }, preview: { host: '127.0.0.1', port: 0, strictPort: false } };
    await build(config);
    server = await preview(config);
    const executablePath = process.env.MARKNOTE_BROWSER_PATH || [chromium.executablePath(), path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')].find(candidate => fs.existsSync(candidate));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage();
    await page.addInitScript(() => { window.isTauri = false; window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }, invoke: async () => undefined }; });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);
    await page.waitForFunction(() => Boolean(window.__editorPerformance));
    const unknown = await page.evaluate(() => window.__editorPerformance.unknown());
    const known = await page.evaluate(() => window.__editorPerformance.known());
    const metrics = { kind: baseline ? 'baseline' : 'optimized', unknown100k: unknown, known21Blocks: known };
    console.log(JSON.stringify(metrics, null, 2));
    const output = path.join(root, 'outputs', 'editor-performance');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, baseline ? 'baseline.json' : 'optimized.json'), JSON.stringify(metrics, null, 2));
    if (!baseline) {
      assert.equal(unknown.load.auto, 0, '100k unknown code never tries every language');
      assert.equal(unknown.edit.auto, 0);
      assert.equal(unknown.selection.scans, 0, 'selection-only transactions do not scan code blocks');
      assert.equal(known.edit.highlight, 1, 'only the edited code block is highlighted once');
      assert.equal(known.prose.highlight, 0, 'prose edits reuse all code decorations');
      assert.equal(known.selection.scans, 0);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    if (path.dirname(path.resolve(temporary)) === root && path.basename(temporary).startsWith('.editor-performance-test-')) fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
