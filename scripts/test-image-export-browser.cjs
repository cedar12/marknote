/* Real dialog/store/editor/capture checks. Only native IPC, notifications, and
 * injected capture waits/errors are simulated; normal captures use html2canvas.
 * Run: node scripts/test-image-export-browser.cjs
 * Optional: MARKNOTE_PLAYWRIGHT_PATH, MARKNOTE_BROWSER_PATH,
 * MARKNOTE_IMAGE_EXPORT_SCREENSHOT_DIR (defaults to logs/image-export).
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
  if (!executablePath) throw new Error('Install Chromium or set MARKNOTE_BROWSER_PATH.');
  return { executablePath };
}

const harness = String.raw`<template>
  <button id="open-export" @click="imageExport.open()">Open export</button>
  <div id="editor-scroll"><EditorContent :editor="editor" /></div>
  <ImageExportDialog />
</template>
<script setup>
import { nextTick, onBeforeUnmount } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { useImageExportStore } from '/src/store/imageExport';
import { useEditorStore } from '/src/store/editor';
import { useAppStore } from '/src/store/app';
import { DEFAULT_IMAGE_EXPORT_OPTIONS } from '/src/utils/imageExportOptions';
import { findThemeByType, setTheme } from '/src/theme';
import i18n from '/src/i18n';
import ImageExportDialog from '/src/components/dialog/ImageExportDialog.vue';

const imageExport = useImageExportStore();
const editorStore = useEditorStore();
const app = useAppStore();
const editor = new Editor({
  extensions: [StarterKit, Markdown],
  content: '# Export fixture\n\n' + Array.from({ length: 18 }, (_, index) => 'Paragraph ' + index + ' retains the source document.\n\n').join(''),
  editorProps: { attributes: { class: 'marknote code-theme-nnfx-light', 'aria-label': 'Source document' } },
});
editorStore.setEditor(editor);
app.filepath = 'D:\\notes\\中文笔记.md';
app.loading = false;
app.isSave = false;
window.__imageExportTest = {
  translate(key) { return i18n.global.t(key); },
  async setLocale(locale) { i18n.global.locale.value = locale; await nextTick(); },
  async setTheme(type) { app.theme = findThemeByType(type); setTheme(app.theme); await nextTick(); },
  async resetOptions() { imageExport.options = { ...DEFAULT_IMAGE_EXPORT_OPTIONS }; await nextTick(); },
  async patchOptions(patch) { Object.assign(imageExport.options, patch); await nextTick(); },
  async focusSource() { editor.commands.focus(undefined, { scrollIntoView: false }); await nextTick(); },
  async setupSource() {
    editor.commands.setTextSelection(5);
    editor.commands.focus(undefined, { scrollIntoView: false });
    await nextTick();
    document.querySelector('#editor-scroll').scrollTop = 180;
  },
  async open() { imageExport.open(); await nextTick(); },
  close() { imageExport.close(); },
  duplicateSubmit() { void imageExport.exportImage(); void imageExport.exportImage(); },
  snapshot() {
    return {
      visible: imageExport.visible, pending: imageExport.pending, stage: imageExport.stage,
      error: imageExport.error, options: { ...imageExport.options }, exporting: app.exporting,
      persisted: JSON.parse(localStorage.getItem('MarkNoteImageExportOptions') || 'null'),
      source: { document: editor.getJSON(), selection: { from: editor.state.selection.from, to: editor.state.selection.to }, scroll: document.querySelector('#editor-scroll').scrollTop, filepath: app.filepath, isSave: app.isSave },
      focused: editor.view.dom.contains(document.activeElement),
      temporaryRoots: document.querySelectorAll('.image-export-document, iframe.html2canvas-container').length,
    };
  },
};
onBeforeUnmount(() => { editorStore.setEditor(undefined); editor.destroy(); });
</script>
<style>
html, body { margin:0; height:100%; overflow:hidden; background:var(--contentBackgroundColor); color:var(--contentTextColor); }
#open-export { margin:16px; }
#editor-scroll { margin:0 16px; height:320px; overflow:auto; border:1px solid var(--contentBorderColor); }
#editor-scroll .marknote { padding:24px; }
</style>`;

const captureWrapper = String.raw`
import { renderDocumentImage as actualRender, ImageExportError } from '/src/utils/imageExport.ts';
export { ImageExportError };
export async function renderDocumentImage(...args) {
  const state = window.__nativeTest;
  state.renderCalls.push({ markdown: args[1], options: { ...args[2] }, sourcePath: args[3] });
  if (state.renderDelay) {
    state.renderDelay = false;
    await new Promise(resolve => { state.renderRelease = resolve; });
  }
  if (state.renderError) throw new ImageExportError(state.renderError, 'Injected capture failure');
  return actualRender(...args);
}`;

function nativeMock() {
  const callbacks = new Map();
  let nextId = 1;
  window.os = 'windows';
  window.isTauri = true;
  localStorage.setItem('lang', localStorage.getItem('lang') || 'en');
  const state = {
    calls: [], renderCalls: [], notifications: [],
    pick: null, pickerError: false, writeResponse: { code: 0 }, writeError: false,
    delayCommand: null, nativeRelease: null, renderDelay: false, renderRelease: null, renderError: null,
    releaseRender() { this.renderRelease?.(); this.renderRelease = null; },
    releaseNative() { this.nativeRelease?.(); this.nativeRelease = null; },
  };
  window.__nativeTest = state;
  window.Notification = class { constructor(title, options) { state.notifications.push({ title, ...options }); } };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
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
        await new Promise(resolve => { state.nativeRelease = resolve; });
      }
      if (command === 'plugin:dialog|save') {
        if (state.pickerError) throw new Error('Injected native picker failure');
        return state.pick;
      }
      if (command === 'export_image') {
        if (state.writeError) throw new Error('Injected native write failure');
        return state.writeResponse;
      }
      if (command.startsWith('plugin:window|') || command.startsWith('plugin:log|')) return;
      throw new Error('Unexpected native command: ' + command);
    },
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.image-export-browser-test-'));
  const screenshots = path.resolve(process.env.MARKNOTE_IMAGE_EXPORT_SCREENSHOT_DIR || path.join(root, 'logs/image-export'));
  let server;
  let browser;
  let page;
  const pageErrors = [];
  const passed = [];
  try {
    fs.mkdirSync(screenshots, { recursive: true });
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';", "import { createPinia } from 'pinia';",
      "import i18n from '/src/i18n';", "import '/src/scss/element-plus.scss';",
      "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';",
      "import '/src/scss/editor.scss';", "import Harness from './Harness.vue';",
      "const app = createApp(Harness);",
      "app.config.errorHandler = error => { window.__vueTestErrors ||= []; window.__vueTestErrors.push(String(error)); console.error(error); };",
      "app.use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Image export test</title></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const wrapperId = '\0image-export-capture-test-wrapper';
    const config = {
      root, configFile: false, logLevel: 'error',
      plugins: [{
        name: 'image-export-inject-capture-boundaries', enforce: 'pre',
        resolveId(source, importer) {
          if (importer?.replaceAll('\\', '/').endsWith('/src/store/imageExport.ts') && source === '../utils/imageExport') return wrapperId;
        },
        load(id) { if (id === wrapperId) return captureWrapper; },
      }, vue()],
      build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } },
      preview: { host: '127.0.0.1', port: 0, strictPort: false },
    };
    console.log('Building real image-export dialog/store/capture browser harness');
    await build(config);
    server = await preview(config);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    page = await browser.newPage({ viewport: { width: 1100, height: 780 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => { pageErrors.push(error.message); console.error(error.message); });
    await page.addInitScript(nativeMock);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__imageExportTest));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__imageExportTest[method](argument), { method, argument });
    const native = patch => page.evaluate(patch => Object.assign(window.__nativeTest, patch), patch);
    const calls = command => page.evaluate(command => window.__nativeTest.calls.filter(call => call.command === command), command);
    const renderCalls = () => page.evaluate(() => window.__nativeTest.renderCalls);
    const label = key => api('translate', key);
    const snapshot = () => api('snapshot');
    const idle = () => page.waitForFunction(() => !window.__imageExportTest.snapshot().pending);
    const dialog = page.getByRole('dialog');
    const submit = async () => { await page.locator('.image-export-submit').click(); await idle(); };
    const radio = async (key, checked = true) => {
      const input = dialog.getByRole('radio', { name: await label(key), exact: true });
      if (checked && !await input.isChecked()) await input.locator('..').click();
      return input;
    };
    const record = description => { passed.push(description); console.log(`PASS ${description}`); };
    const resetNative = () => native({ calls: [], renderCalls: [], notifications: [], pick: null, pickerError: false, writeError: false, writeResponse: { code: 0 }, renderError: null });

    await api('setupSource');
    await page.locator('#open-export').click();
    await dialog.waitFor();
    assert.deepEqual((await snapshot()).options, { format: 'png', width: 960, scale: 1, background: 'theme', quality: 0.9 });
    await page.waitForFunction(() => document.activeElement?.matches('input[type="radio"]:checked'));
    await page.screenshot({ path: path.join(screenshots, 'dialog-english-light.png') });
    record('dialog opens with fast PNG defaults and keyboard focus');

    await radio('imageExportBackgroundTransparent');
    await dialog.getByRole('radio', { name: 'JPEG', exact: true }).locator('..').click();
    assert.equal((await snapshot()).options.background, 'white');
    assert.equal(await (await radio('imageExportBackgroundTransparent', false)).isDisabled(), true);
    const quality = dialog.getByRole('slider');
    await quality.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal((await snapshot()).options.quality, 0.89);
    assert.equal(await quality.getAttribute('aria-describedby'), 'image-export-quality-hint');
    const widthInput = dialog.getByRole('spinbutton');
    await widthInput.fill('1200');
    await widthInput.press('Tab');
    await radio('imageExportSharp');
    assert.deepEqual((await snapshot()).options, { format: 'jpeg', width: 1200, scale: 2, background: 'white', quality: 0.89 });
    record('JPEG disables transparency and supports keyboard quality, width, and resolution settings');

    const optionsBeforeCancel = (await snapshot()).options;
    const sourceBeforeCancel = (await snapshot()).source;
    await resetNative();
    await submit();
    assert.equal((await snapshot()).visible, true);
    assert.equal((await snapshot()).error, null);
    assert.deepEqual((await snapshot()).options, optionsBeforeCancel);
    assert.deepEqual((await snapshot()).source, sourceBeforeCancel);
    assert.equal((await renderCalls()).length, 0);
    assert.equal((await calls('export_image')).length, 0);
    assert.equal((await calls('plugin:dialog|save')).length, 1);
    record('native picker cancellation keeps settings and performs no render or write');

    await native({ pick: 'D:\\notes\\export.jpg' });
    await submit();
    await dialog.waitFor({ state: 'hidden' });
    const successful = (await calls('export_image'))[0];
    assert.equal(successful.args.path, 'D:\\notes\\export.jpg');
    assert.ok(successful.args.base64.startsWith('data:image/jpeg;base64,'));
    assert.deepEqual((await renderCalls())[0].options, optionsBeforeCancel);
    assert.deepEqual((await snapshot()).persisted, optionsBeforeCancel);
    assert.equal((await snapshot()).temporaryRoots, 0);
    assert.equal(await page.evaluate(() => window.__nativeTest.notifications.length), 1);
    await page.waitForFunction(() => window.__imageExportTest.snapshot().focused);
    assert.deepEqual((await snapshot()).source, sourceBeforeCancel, 'Successful export must preserve document, caret, and scroll');
    record('real JPEG rendering saves one image, persists settings, notifies, and restores editor focus');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__imageExportTest));
    await api('open');
    await dialog.waitFor();
    assert.deepEqual((await snapshot()).options, optionsBeforeCancel);
    record('successful export settings survive a full reload');

    await api('close');
    await dialog.waitFor({ state: 'hidden' });
    await api('setupSource');
    await api('open');
    await dialog.waitFor();
    const beforeDialogCancel = (await snapshot()).source;
    await dialog.getByRole('button', { name: await label('cancel'), exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.__imageExportTest.snapshot().focused);
    assert.deepEqual((await snapshot()).source, beforeDialogCancel, 'Cancelling the dialog must restore focus without scrolling to an offscreen caret');
    record('dialog cancellation restores focus while preserving an offscreen caret and scroll position');
    await api('open');
    await dialog.waitFor();
    await api('resetOptions');

    await resetNative();
    await native({ pickerError: true });
    await submit();
    assert.equal((await snapshot()).error, 'imageExportPickerFailed');
    assert.equal(await dialog.getByRole('alert').textContent(), await label('imageExportPickerFailed'));
    assert.equal((await renderCalls()).length, 0);
    assert.equal((await calls('export_image')).length, 0);
    record('native picker failures show a translated retryable error');

    await resetNative();
    await native({ pick: 'D:\\notes\\export.jpg' });
    await submit();
    assert.equal((await snapshot()).error, 'imageExportPathMismatch');
    assert.equal((await renderCalls()).length, 0);
    assert.equal((await calls('export_image')).length, 0);
    record('a mismatched extension is rejected before capture or write');

    await resetNative();
    await native({ pick: 'D:\\notes\\export.png', writeResponse: { code: 1, info: 'Destination write failed' } });
    const original = (await snapshot()).source;
    await submit();
    assert.equal((await snapshot()).error, 'imageExportWriteFailed');
    assert.equal((await snapshot()).visible, true);
    assert.deepEqual((await snapshot()).source, original);
    assert.equal(await dialog.getByRole('alert').textContent(), await label('imageExportWriteFailed'));
    assert.equal(await page.evaluate(() => window.__nativeTest.notifications.length), 0);
    assert.equal((await snapshot()).temporaryRoots, 0);
    record('nonzero write responses preserve source state and expose a localized retry without notification');

    await native({ writeResponse: { code: 0 }, renderDelay: true, delayCommand: 'export_image' });
    await page.locator('.image-export-submit').click();
    await page.waitForFunction(() => Boolean(window.__nativeTest.renderRelease));
    assert.equal((await snapshot()).stage, 'rendering');
    assert.equal((await snapshot()).exporting, true);
    assert.equal(await page.locator('.image-export-submit').isDisabled(), true);
    assert.equal(await dialog.getByRole('button', { name: await label('cancel'), exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole('status').textContent(), await label('imageExportRendering'));
    await api('duplicateSubmit');
    await api('close');
    await page.keyboard.press('Escape');
    assert.equal((await snapshot()).visible, true);
    assert.equal((await calls('plugin:dialog|save')).length, 2);
    await page.evaluate(() => window.__nativeTest.releaseRender());
    await page.waitForFunction(() => Boolean(window.__nativeTest.nativeRelease));
    assert.equal((await snapshot()).stage, 'saving');
    assert.equal(await dialog.getByRole('status').textContent(), await label('imageExportSaving'));
    assert.equal((await calls('export_image')).length, 2);
    await api('duplicateSubmit');
    await page.evaluate(() => window.__nativeTest.releaseNative());
    await idle();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal((await calls('plugin:dialog|save')).length, 2);
    assert.equal((await calls('export_image')).length, 2);
    assert.equal((await snapshot()).exporting, false);
    assert.deepEqual((await snapshot()).source, original);
    assert.equal(await page.evaluate(() => window.__nativeTest.notifications.length), 1);
    record('retry succeeds; duplicate submissions and closing are blocked while rendering and saving');

    await api('open');
    await dialog.waitFor();
    await resetNative();
    await native({ pick: 'D:\\notes\\export.png', renderError: 'imageExportImageFailed' });
    await submit();
    assert.equal((await snapshot()).error, 'imageExportImageFailed');
    assert.equal((await snapshot()).exporting, false);
    assert.equal((await calls('export_image')).length, 0);
    record('typed capture failures release the busy state without writing');

    await api('setLocale', 'zhCn');
    assert.equal(await dialog.getAttribute('aria-label'), await label('imageExportTitle'));
    assert.equal(await dialog.getByRole('alert').textContent(), await label('imageExportImageFailed'));
    assert.equal(await dialog.getByRole('button', { name: await label('imageExportRetry'), exact: true }).count(), 1);
    await api('setTheme', 'dark');
    await dialog.getByRole('radio', { name: 'JPEG', exact: true }).locator('..').click();
    assert.equal((await snapshot()).options.format, 'jpeg');
    await page.waitForFunction(() => document.querySelector('.image-export-dialog input[value="jpeg"]')?.checked);
    await dialog.getByRole('slider').waitFor();
    await page.setViewportSize({ width: 390, height: 640 });
    await page.screenshot({ path: path.join(screenshots, 'dialog-chinese-dark-narrow.png') });
    const geometry = await dialog.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const footer = element.querySelector('.el-dialog__footer').getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, bottom: bounds.bottom, footerBottom: footer.bottom, width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, background: getComputedStyle(element).backgroundColor };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.width + 1 && geometry.bottom <= geometry.height + 1);
    assert.ok(geometry.footerBottom <= geometry.height + 1);
    assert.equal(geometry.overflow, false);
    assert.notEqual(geometry.background, 'rgb(255, 255, 255)');
    record('Chinese retry labels and dark settings fit a 390×640 window with visible actions');

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.__imageExportTest.snapshot().focused);
    assert.deepEqual(pageErrors, [], 'No uncaught browser errors');
    assert.deepEqual(await page.evaluate(() => window.__vueTestErrors || []), [], 'No Vue render or event errors');
    record('Escape closes the idle dialog and restores editor focus');
    fs.writeFileSync(path.join(screenshots, 'browser-checks.json'), JSON.stringify({ passed, pageErrors }, null, 2));
    console.log(`image export browser regression: ${passed.length} checks passed`);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(screenshots, 'dialog-failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(screenshots, 'dialog-failure.html'), await page.content().catch(() => ''));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) === root && path.basename(resolved).startsWith('.image-export-browser-test-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
