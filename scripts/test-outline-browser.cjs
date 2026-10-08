/*
 * Real-browser outline regression checks against Toc.vue and the editor store.
 * Run: node scripts/test-outline-browser.cjs
 * Install Playwright locally, or set MARKNOTE_PLAYWRIGHT_PATH to its package.
 * Optional: MARKNOTE_BROWSER_PATH and MARKNOTE_OUTLINE_SCREENSHOT_DIR.
 * The mount harness is built inside the workspace and removed on completion.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function loadPlaywright() {
  const candidates = [
    process.env.MARKNOTE_PLAYWRIGHT_PATH,
    'playwright',
    path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Playwright is required. Install it or set MARKNOTE_PLAYWRIGHT_PATH.');
}

function browserOptions(chromium) {
  if (process.env.MARKNOTE_BROWSER_PATH) return { executablePath: process.env.MARKNOTE_BROWSER_PATH };
  if (fs.existsSync(chromium.executablePath())) return {};
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ] : [];
  const executablePath = candidates.find(candidate => fs.existsSync(candidate));
  if (!executablePath) throw new Error('Install a Playwright Chromium browser or set MARKNOTE_BROWSER_PATH.');
  return { executablePath };
}

const harness = String.raw`<template>
  <aside id="test-sidebar"><Toc /></aside>
  <main id="test-editor" class="el-scrollbar__wrap">
    <nav v-if="store.segmented" class="segment-navigation">Segment {{ store.segmentIndex + 1 }} / {{ store.segmentCount }}</nav>
    <EditorContent :editor="editor" />
  </main>
</template>
<script setup>
import { nextTick, onBeforeUnmount } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { useEditorStore } from '/src/store/editor';
import { Heading } from '/src/extensions/heading';
import { Markdown } from '/src/extensions/markdown';
import i18n from '/src/i18n';
import Toc from '/src/components/Toc.vue';

const store = useEditorStore();
const editor = new Editor({
  extensions: [StarterKit.configure({ heading: false }), Heading, Markdown.configure({ html: true, breaks: true })],
  injectCSS: false,
  content: '',
  onUpdate() { store.markCurrentSegmentEdited(); store.updateHeadings(); },
});
store.setEditor(editor);

window.__outlineTest = {
  async setContent(content) { await store.setContent(content); await nextTick(); },
  async setLocale(locale) { i18n.global.locale.value = locale; await nextTick(); },
  async setBusy(value) { store.loading = value; await nextTick(); },
  async navigateToText(text) { return store.navigateToHeading(store.headings.find(heading => heading.text === text)); },
  snapshot() {
    return {
      segmented: store.segmented,
      segmentIndex: store.segmentIndex,
      segmentCount: store.segmentCount,
      headings: store.headings.map(h => ({ ...h })),
      selection: editor.state.selection.from,
      selectedHeading: editor.state.selection.$from.parent.type.name === 'heading' ? editor.state.selection.$from.parent.textContent : null,
      scrollTop: document.querySelector('#test-editor').scrollTop,
      dirty: store.segmentDirty,
      markdown: store.getMarkdown(),
    };
  },
  invalidateFirstHeading() { store.headings[0].headingIndex = 99999; },
  async editSelectedHeading(text) {
    const selection = editor.state.selection;
    const node = selection.$from.parent;
    if (node.type.name !== 'heading') throw new Error('Selection must be inside a heading');
    const start = selection.$from.start();
    editor.view.dispatch(editor.state.tr.insertText(text, start, start + node.content.size));
    await nextTick();
  },
  async insertHeadingBefore({ before, text, level }) {
    let position;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading' && node.textContent === before) position = pos; });
    if (position === undefined) throw new Error('Heading to insert before was not found');
    const node = editor.schema.nodes.heading.create({ level }, editor.schema.text(text));
    editor.view.dispatch(editor.state.tr.insert(position, node));
    await nextTick();
  },
  async removeHeading(text) {
    let range;
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'heading' && node.textContent === text) range = { from: pos, to: pos + node.nodeSize }; });
    if (!range) throw new Error('Heading to delete was not found');
    editor.view.dispatch(editor.state.tr.delete(range.from, range.to));
    await nextTick();
  },
  async holdRendering() {
    const original = store.renderEditorBody;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    store.renderEditorBody = async content => { await gate; return original.call(store, content); };
    window.__outlineTest.releaseRendering = () => { store.renderEditorBody = original; release(); };
  },
};
onBeforeUnmount(() => { store.setEditor(undefined); editor.destroy(); });
</script>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; }
#outline-test-root { display: flex; height: 100vh; font: 14px system-ui, sans-serif; }
#test-sidebar { width: min(220px, 45vw); padding: 8px; box-sizing: border-box; flex: none; background: var(--primaryBackgroundColor); color: var(--primaryTextColor); min-height: 0; }
#test-editor { min-width: 0; flex: 1; overflow: auto; padding: 20px; box-sizing: border-box; }
.segment-navigation { position: sticky; top: 0; z-index: 3; min-height: 34px; padding: 4px 12px; box-sizing: border-box; background: var(--contentBackgroundColor); border-bottom: 1px solid var(--contentBorderColor); }
.ProseMirror { outline: none; overflow-wrap: anywhere; }
.ProseMirror p { line-height: 1.5; }
.ProseMirror h1, .ProseMirror h2, .ProseMirror h3 { scroll-margin-top: 16px; }
</style>`;

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.outline-browser-test-'));
  let server;
  let browser;
  const pageErrors = [];
  const passed = [];
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';",
      "import { createPinia } from 'pinia';",
      "import i18n from '/src/i18n';",
      "import 'element-plus/dist/index.css';",
      "import '/src/styles.css';",
      "import Harness from './Harness.vue';",
      "createApp(Harness).use(createPinia()).use(i18n).mount('#outline-test-root');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Outline browser test</title></head><body><div id="outline-test-root"></div><script type="module" src="./main.js"></script></body></html>');

    const config = {
      root,
      configFile: false,
      plugins: [vue()],
      build: {
        outDir: path.join(temporary, 'dist'),
        emptyOutDir: true,
        minify: false,
        rollupOptions: { input: path.join(temporary, 'index.html') },
      },
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
      logLevel: 'error',
    };
    console.log('Building isolated outline browser harness');
    await build(config);
    server = await preview(config);
    const port = server.httpServer.address().port;
    console.log(`Outline browser harness: http://127.0.0.1:${port}/${path.basename(temporary)}/index.html`);
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 680 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => { pageErrors.push(error.message); console.error(`Page error: ${error.message}`); });
    page.on('console', message => { if (message.type() === 'error') console.error(`Browser: ${message.text()}`); });
    page.on('requestfailed', request => console.error(`Request failed: ${request.url()} ${request.failure()?.errorText}`));
    console.log('Chromium launched');
    await page.goto(`http://127.0.0.1:${port}/${path.basename(temporary)}/index.html`, { waitUntil: 'domcontentloaded' });
    console.log('Mount page loaded');
    await page.waitForFunction(() => Boolean(window.__outlineTest));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__outlineTest[method](argument), { method, argument });
    const headings = () => page.locator('.outliner-heading');
    const heading = text => page.getByRole('button', { name: text, exact: true });
    const filter = () => page.locator('.outliner-search input');
    const record = description => { passed.push(description); console.log(`PASS ${description}`); };

    await api('setContent', 'A document without headings.');
    await page.getByRole('status').filter({ hasText: 'Add a heading to create an outline.' }).waitFor();
    await api('setLocale', 'zhCn');
    await page.getByRole('status').filter({ hasText: '添加标题后将在这里显示目录' }).waitFor();
    assert.equal(await filter().getAttribute('placeholder'), '过滤标题');
    record('empty state and Chinese locale');
    await api('setLocale', 'en');

    const nesting = '# Root Alpha\n\n## Nested Branch\n\n### Hidden Target 中文\n\n### Repeat Title\n\n# Root Omega\n\n## Last Child\n\n';
    await api('setContent', nesting);
    assert.equal(await headings().count(), 6);
    await page.getByRole('button', { name: 'Collapse Nested Branch', exact: true }).click();
    assert.equal(await heading('Hidden Target 中文').count(), 0);
    await page.getByRole('button', { name: 'Collapse Root Alpha', exact: true }).click();
    assert.equal(await headings().count(), 3);
    await page.getByRole('button', { name: 'Expand Root Alpha', exact: true }).click();
    assert.equal(await heading('Nested Branch').count(), 1);
    assert.equal(await heading('Hidden Target 中文').count(), 0);
    record('nested disclosure state survives parent collapse and reopen');

    await filter().fill('hidden target');
    await heading('Hidden Target 中文').waitFor();
    assert.equal(await headings().count(), 1);
    await filter().fill('中文');
    assert.equal(await headings().count(), 1);
    const clear = page.getByRole('button', { name: 'Clear heading filter', exact: true });
    await clear.focus();
    await page.keyboard.press('Enter');
    assert.equal(await filter().inputValue(), '');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.outliner-search input')), true);
    assert.equal(await heading('Hidden Target 中文').count(), 0);
    await filter().fill('there-is-no-match');
    await page.getByRole('status').filter({ hasText: 'No matching headings.' }).waitFor();
    await api('setLocale', 'zhCn');
    await page.getByRole('status').filter({ hasText: '没有匹配的标题' }).waitFor();
    await page.getByRole('button', { name: '清除标题过滤', exact: true }).click();
    await api('setLocale', 'en');
    record('filter searches collapsed descendants, ignores case, clears with focus, and localizes no-results');

    await api('insertHeadingBefore', { before: 'Nested Branch', text: 'Inserted Branch', level: 2 });
    assert.equal((await api('snapshot')).headings.find(item => item.text === 'Nested Branch').status, 'close', 'inserting a heading must not move a sibling disclosure state');
    assert.equal(await heading('Hidden Target 中文').count(), 0);
    await api('removeHeading', 'Inserted Branch');
    assert.equal((await api('snapshot')).headings.find(item => item.text === 'Nested Branch').status, 'close', 'deleting a heading must preserve remaining disclosure states');
    assert.equal(await heading('Hidden Target 中文').count(), 0);
    record('inserting and deleting headings preserves disclosure state of existing headings');

    const expandNested = page.getByRole('button', { name: 'Expand Nested Branch', exact: true });
    await expandNested.focus();
    await page.keyboard.press('Space');
    await heading('Hidden Target 中文').waitFor();
    await heading('Hidden Target 中文').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Hidden Target 中文');
    record('keyboard disclosure and heading navigation');

    await api('setBusy', true);
    assert.equal(await heading('Root Alpha').isDisabled(), true);
    assert.equal(await page.locator('.marknote-outliner').getAttribute('aria-busy'), 'true');
    await api('setBusy', false);
    await api('invalidateFirstHeading');
    await heading('Root Alpha').click();
    await page.getByRole('alert').filter({ hasText: 'Could not jump to this heading. Try again.' }).waitFor();
    await api('setContent', nesting);
    await heading('Root Alpha').click();
    assert.equal(await page.getByRole('alert').count(), 0);
    record('busy controls and recoverable navigation failure');

    const padding = ('Ordinary paragraph content for segmented outline regression. '.repeat(12) + '\n\n').repeat(195);
    const largeContent = [
      '# Root Alpha\n\n## Nested Branch\n\n### Hidden Target 中文\n\n', padding,
      '# Chapter Beta\n\n## Repeat Title\n\n', padding,
      '# Chapter Gamma\n\n## Repeat Title\n\n', padding,
      '# Chapter Delta\n\n', padding,
      '# Last Chapter\n\n', ('Extra paragraph for scroll verification.\n\n').repeat(100),
      '## Final Target 中文\n\nEnd of the document.\n',
    ].join('');
    await api('setContent', largeContent);
    let snapshot = await api('snapshot');
    assert.equal(snapshot.segmented, true);
    assert.ok(snapshot.segmentCount > 1);
    assert.equal(snapshot.headings.length, 10);
    assert.equal(snapshot.markdown, largeContent);
    const target = snapshot.headings.find(item => item.text === 'Final Target 中文');
    assert.ok(target.segmentIndex > 0);
    assert.equal(await heading('Final Target 中文').count(), 1);
    record(`whole-document outline indexes all ${snapshot.segmentCount} segments before they are opened`);

    await api('holdRendering');
    await heading('Final Target 中文').click();
    await page.waitForFunction(() => document.querySelector('.marknote-outliner').getAttribute('aria-busy') === 'true');
    assert.equal(await heading('Root Alpha').isDisabled(), true);
    assert.equal(await api('navigateToText', 'Root Alpha'), false, 'a concurrent navigation must be rejected while rendering the target');
    await api('releaseRendering');
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Final Target 中文');
    await page.waitForFunction(() => document.querySelector('.marknote-outliner').getAttribute('aria-busy') === 'false');
    snapshot = await api('snapshot');
    assert.equal(snapshot.segmentIndex, target.segmentIndex);
    assert.ok(snapshot.scrollTop > 0, 'navigation should scroll the editor to a heading below the fold');
    const targetVisibility = await page.evaluate(() => {
      const container = document.querySelector('#test-editor').getBoundingClientRect();
      const target = Array.from(document.querySelectorAll('.ProseMirror h1,.ProseMirror h2,.ProseMirror h3')).find(element => element.textContent === 'Final Target 中文').getBoundingClientRect();
      return target.top >= container.top && target.bottom <= container.bottom;
    });
    assert.equal(targetVisibility, true);
    assert.equal(snapshot.markdown, largeContent, 'visiting a segment must preserve untouched source');
    await heading('Last Chapter').click();
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Last Chapter');
    const stickyVisibility = await page.evaluate(() => {
      const bar = document.querySelector('.segment-navigation').getBoundingClientRect();
      const heading = Array.from(document.querySelectorAll('.ProseMirror h1,.ProseMirror h2,.ProseMirror h3')).find(element => element.textContent === 'Last Chapter').getBoundingClientRect();
      return heading.top >= bar.bottom - 1;
    });
    assert.equal(stickyVisibility, true, 'the selected heading must not be hidden beneath the sticky segment bar');
    assert.equal((await api('snapshot')).segmentIndex, target.segmentIndex, 'sticky-bar navigation should stay within the same segment');
    await heading('Final Target 中文').click();
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Final Target 中文');
    record('same-segment upward navigation keeps the selected heading below the sticky segment bar');
    await api('editSelectedHeading', 'Final Target Edited 中文');
    await heading('Final Target Edited 中文').waitFor();
    await heading('Root Alpha').click();
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Root Alpha');
    assert.ok((await api('snapshot')).markdown.includes('## Final Target Edited 中文'));
    await heading('Final Target Edited 中文').click();
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Final Target Edited 中文');
    record('cross-segment navigation selects and scrolls to the target, preserves source, and retains edits');

    const repeated = page.getByRole('button', { name: 'Repeat Title', exact: true });
    await repeated.nth(1).click();
    await page.waitForFunction(() => window.__outlineTest.snapshot().selectedHeading === 'Repeat Title');
    snapshot = await api('snapshot');
    assert.equal(snapshot.segmentIndex, snapshot.headings.filter(item => item.text === 'Repeat Title')[1].segmentIndex);
    record('duplicate heading text navigates by segment and heading identity');

    await page.setViewportSize({ width: 420, height: 360 });
    const longTitle = '这是一个用于验证窄侧边栏自动换行并完整显示的非常长标题 '.repeat(5) + '最后一行';
    const manyHeadings = Array.from({ length: 35 }, (_, index) => `# Heading ${index + 1}\n\n`).join('') + `# ${longTitle}\n\n`;
    await api('setContent', manyHeadings);
    const last = heading(longTitle);
    await last.scrollIntoViewIfNeeded();
    const geometry = await page.evaluate(() => {
      const sidebar = document.querySelector('#test-sidebar');
      const scroll = document.querySelector('.outliner-scrollbar .el-scrollbar__wrap');
      const finalHeading = Array.from(document.querySelectorAll('.outliner-heading')).at(-1);
      const bounds = finalHeading.getBoundingClientRect();
      const viewport = scroll.getBoundingClientRect();
      return {
        sidebarWidth: sidebar.clientWidth,
        sidebarScrollWidth: sidebar.scrollWidth,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
        lastHeight: bounds.height,
        finalLineVisible: bounds.bottom <= viewport.bottom + 1,
        viewportBottom: viewport.bottom,
        screenHeight: window.innerHeight,
        contentWidth: document.documentElement.scrollWidth,
        screenWidth: window.innerWidth,
      };
    });
    assert.ok(geometry.scrollHeight > geometry.clientHeight);
    assert.ok(geometry.lastHeight > 26, 'a long heading should wrap');
    assert.equal(geometry.finalLineVisible, true, 'the last line must be reachable by scrolling');
    assert.ok(geometry.sidebarScrollWidth <= geometry.sidebarWidth + 1, 'sidebar should not overflow horizontally');
    assert.ok(geometry.viewportBottom <= geometry.screenHeight + 1, 'outline viewport stays on screen');
    assert.ok(geometry.contentWidth <= geometry.screenWidth + 1, 'narrow layout should not overflow the page');
    await page.keyboard.press('Tab');
    await last.focus();
    assert.equal(await last.evaluate(element => element.matches(':focus-visible')), true);
    record('narrow viewport wraps long headings and exposes the last line with keyboard focus');

    if (process.env.MARKNOTE_OUTLINE_SCREENSHOT_DIR) {
      const output = path.resolve(process.env.MARKNOTE_OUTLINE_SCREENSHOT_DIR);
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, 'outline-narrow.png') });
    }
    assert.deepEqual(pageErrors, [], 'browser should not report uncaught errors');
    console.log(`outline browser regression: ${passed.length} checks passed`);
  } catch (error) {
    console.error(`Outline test failed after ${passed.length} checks:`, error);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    if (path.dirname(temporary) === root && path.basename(temporary).startsWith('.outline-browser-test-')) {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
