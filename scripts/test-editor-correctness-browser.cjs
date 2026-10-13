/* Run with node --preserve-symlinks scripts/test-editor-correctness-browser.cjs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required. Set MARKNOTE_PLAYWRIGHT_PATH.');
}

const harness = String.raw`<template>
  <SearchAndReplace />
  <main class="el-scrollbar__wrap"><EditorContent :editor="editor" /></main>
</template>
<script setup>
import { nextTick, onBeforeUnmount } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Link } from '/src/extensions/link';
import { Markdown } from '/src/extensions/markdown';
import { SearchAndReplace as SearchExtension } from '/src/extensions/searchAndReplace';
import SearchAndReplace from '/src/components/SearchAndReplace.vue';
import { useEditorStore } from '/src/store/editor';
import { useAppStore } from '/src/store/app';
const store = useEditorStore();
const app = useAppStore();
const editor = new Editor({
  content: '', injectCSS: false,
  extensions: [StarterKit, Image.configure({ inline: true }), Link, Markdown.configure({ html: true }), SearchExtension],
  onUpdate() { store.markCurrentSegmentEdited(); store.updateHeadings(); },
});
store.setEditor(editor);
window.__editorCorrectness = {
  async setContent(content) { await store.setContent(content); store.findVisbile = true; await nextTick(); },
  async showSegment(index) { await store.showSegment(index); await nextTick(); },
  async closeSearch() { store.findVisbile = false; await nextTick(); },
  async setBusy(value) { app.lifecycleBusy = value; await nextTick(); },
  async editHeading(text) {
    let position;
    editor.state.doc.descendants((node, pos) => { if (position === undefined && node.type.name === 'heading') position = pos; });
    if (position === undefined) throw new Error('No heading');
    const node = editor.state.doc.nodeAt(position);
    editor.view.dispatch(editor.state.tr.insertText(text, position + 1, position + 1 + node.content.size));
    await nextTick();
  },
  async reopen() { const markdown = store.getMarkdown(); await store.setContent(markdown); await nextTick(); },
  undo() { return editor.commands.undo(); },
  snapshot() {
    return { text: editor.state.doc.textContent, html: editor.getHTML(), markdown: store.getMarkdown(), segmented: store.segmented,
      segmentIndex: store.segmentIndex, segments: [...store.segments], headings: store.headings.map(heading => heading.text),
      results: editor.storage.searchAndReplace.results, index: editor.storage.searchAndReplace.index,
      selection: { from: editor.state.selection.from, to: editor.state.selection.to } };
  },
};
onBeforeUnmount(() => { store.setEditor(undefined); editor.destroy(); });
</script>
<style>
html, body { margin: 0; padding: 0; font-family: sans-serif; }
main { margin-top: 110px; height: 550px; overflow-y: auto; }
.tiptap { padding: 12px; }
</style>`;

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.editor-correctness-browser-test-'));
  let server;
  let browser;
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), "import { createApp } from 'vue';\nimport { createPinia } from 'pinia';\nimport i18n from '/src/i18n';\nimport Harness from './Harness.vue';\ni18n.global.locale.value = 'en';\ncreateApp(Harness).use(createPinia()).use(i18n).mount('#test-root');\n");
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="test-root"></div><script type="module" src="./main.js"></script></body></html>');
    const config = { root, configFile: false, plugins: [vue()], logLevel: 'error', build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } }, preview: { host: '127.0.0.1', port: 0, strictPort: false } };
    await build(config);
    server = await preview(config);
    const explicitBrowser = process.env.MARKNOTE_BROWSER_PATH || [chromium.executablePath(),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ].find(candidate => fs.existsSync(candidate));
    browser = await chromium.launch({ headless: true, ...(explicitBrowser ? { executablePath: explicitBrowser } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    // The app store reads window metadata at module load. Stub that native
    // boundary while keeping isTauri=false to exercise the browser renderer.
    await page.addInitScript(() => {
      window.os = 'windows';
      window.isTauri = false;
      window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        invoke: async command => { throw new Error('Unexpected native IPC: ' + command); } };
    });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(`Browser error: ${error.message}`); });
    page.on('console', message => { if (message.type() === 'error') console.error(`Browser console: ${message.text()}`); });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);
    await page.waitForFunction(() => Boolean(window.__editorCorrectness));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__editorCorrectness[method](argument), { method, argument });
    const search = page.getByPlaceholder('Find', { exact: true });
    const replaceInput = page.getByPlaceholder('Replace', { exact: true });
    const clearQuery = page.locator('.search-content button').nth(0);
    const next = page.locator('.search-content button').nth(1);
    const previous = page.locator('.search-content button').nth(2);
    const replace = page.getByRole('button', { name: 'Replace', exact: true });

    await api('setContent', 'foo foo foo');
    await search.fill('foo');
    await search.press('Enter');
    assert.deepEqual((await api('snapshot')).selection, { from: 1, to: 4 });
    await next.click();
    await next.click();
    assert.deepEqual((await api('snapshot')).selection, { from: 9, to: 12 });
    await page.locator('.tool-more button').click();
    await replaceInput.fill('bar');
    await replace.click();
    assert.equal((await api('snapshot')).text, 'foo foo bar', 'clicking Replace changes the displayed third match without advancing first');
    assert.equal(await page.locator('.results-count-info').textContent(), '1/2');
    await previous.click();
    assert.deepEqual((await api('snapshot')).selection, { from: 5, to: 8 });
    await replace.click();
    assert.equal((await api('snapshot')).text, 'foo bar bar');
    await clearQuery.click();
    assert.equal(await search.inputValue(), '');
    assert.equal(await search.evaluate(input => input === document.activeElement), true, 'clear keeps the panel open and restores search focus');
    assert.equal(await replace.isDisabled(), true);
    assert.equal((await api('snapshot')).text, 'foo bar bar');
    assert.deepEqual((await api('snapshot')).results, []);
    await search.fill('foo');
    await api('closeSearch');
    assert.deepEqual((await api('snapshot')).results, [], 'closing the panel removes stale decorations');
    console.log('PASS real SearchAndReplace component: current replacement, wrap navigation, clear and close');

    await api('setContent', 'foo foo foo');
    await search.fill('foo');
    await search.press('Enter');
    await search.focus();
    await search.evaluate(input => {
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.value = 'bar';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true }));
    });
    assert.deepEqual((await api('snapshot')).selection, { from: 1, to: 4 }, 'IME Enter does not navigate');
    assert.equal((await api('snapshot')).results.length, 3, 'uncommitted IME input does not refresh search results');
    assert.equal(await search.evaluate(input => input === document.activeElement), true, 'IME composition retains input focus');
    await search.evaluate(input => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'bar' })));
    assert.equal((await api('snapshot')).results.length, 0, 'committed composition refreshes results');
    await search.fill('foo');
    await api('setBusy', true);
    assert.equal(await replace.isDisabled(), true, 'lifecycle locks disable replacement controls');
    await api('setBusy', false);
    assert.equal(await replace.isEnabled(), true);
    for (const label of await page.locator('.search-and-replace-tool button, .search-and-replace-tool input').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label') || element.textContent?.trim()))) assert.ok(label, 'every search control has an accessible name');
    await page.setViewportSize({ width: 360, height: 720 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'search controls fit a narrow viewport');
    await page.setViewportSize({ width: 1100, height: 720 });
    console.log('PASS real IME input: composition defers search, Enter retains selection/focus, controls have labels and busy states');
    await replaceInput.fill('longer');
    await page.getByRole('button', { name: 'Replace All', exact: true }).click();
    assert.equal((await api('snapshot')).text, 'longer longer longer');
    assert.equal(await api('undo'), true);
    assert.equal((await api('snapshot')).text, 'foo foo foo');
    console.log('PASS real editor: replace all is a single undo operation');

    const padding = 'Padding paragraph with enough content.\n\n'.repeat(15000);
    const large = '# [First heading][target]\r\n\r\n[text][target]\r\n\r\n' + padding + '# Definitions\r\n\r\n[target]: https://example.com/ "Remote title"\r\n\r\n';
    await api('setContent', large);
    const untouched = await api('snapshot');
    assert.equal(untouched.segmented, true);
    assert.ok(untouched.segments.length > 1);
    assert.equal(untouched.markdown, large, 'untouched real large document saves exactly');
    assert.ok(untouched.html.includes('href="https://example.com/"'));
    assert.equal(untouched.headings[0], 'First heading', 'headings resolve references outside the loaded segment');
    const finalIndex = untouched.segments.length - 1;
    await api('showSegment', finalIndex);
    await api('editHeading', 'Edited definitions');
    const edited = await api('snapshot');
    assert.ok(edited.markdown.includes('[TARGET]: <https://example.com/> "Remote title"'), 'editing the definition segment keeps its invisible definition');
    assert.deepEqual(edited.segments.slice(0, finalIndex), untouched.segments.slice(0, finalIndex), 'unedited segments retain exact source');
    await api('reopen');
    assert.ok((await api('snapshot')).html.includes('href="https://example.com/"'), 'save and reopen preserves cross-segment link semantics');
    console.log('PASS real 512 KB threshold: remote links/headings, edited definitions and untouched original source');

    const nested = padding + '- Item\n\n  continued paragraph\n\n- Second item\n\n# After\n\n';
    await api('setContent', nested);
    const nestedSnapshot = await api('snapshot');
    const listIndex = nestedSnapshot.segments.findIndex(segment => segment.includes('- Item'));
    assert.ok(nestedSnapshot.segments[listIndex].includes('  continued paragraph\n\n- Second item'));
    await api('showSegment', listIndex);
    assert.ok((await api('snapshot')).html.includes('<li><p>Item</p><p>continued paragraph</p></li>'));
    console.log('PASS real large editor: list continuation remains within its list item');

    await api('setContent', '````markdown\nbefore\n```\nafter\n````\n');
    const code = await api('snapshot');
    assert.ok(code.markdown.startsWith('````markdown'));
    await api('reopen');
    const reopened = await api('snapshot');
    assert.equal((await page.locator('.tiptap pre').count()), 1);
    assert.equal(reopened.text, 'before\n```\nafter');
    console.log('PASS real editor: embedded code fence survives save and reopen');
    assert.deepEqual(errors, [], 'browser reports no uncaught errors');
    console.log('editor correctness browser: 6 groups passed');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    if (path.dirname(path.resolve(temporary)) === root && path.basename(temporary).startsWith('.editor-correctness-browser-test-')) fs.rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
