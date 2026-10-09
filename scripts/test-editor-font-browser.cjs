/*
 * Real-browser checks for editor font preferences.
 * Run: node scripts/test-editor-font-browser.cjs
 * Optional: MARKNOTE_PLAYWRIGHT_PATH, MARKNOTE_BROWSER_PATH,
 * MARKNOTE_EDITOR_FONT_SCREENSHOT_DIR. Native IPC is simulated; the actual
 * settings panel, preference store, CSS and Tiptap editor are mounted.
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
  <Preferences />
  <div id="test-runtime-editor" hidden><EditorContent :editor="editor" /></div>
</template>
<script setup>
import { nextTick, watch, onBeforeUnmount } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { closeHistory, undoDepth, redoDepth } from '@tiptap/pm/history';
import { createEditor } from '/src/utils/editor';
import { usePreferencesStore } from '/src/store/preferences';
import { useEditorStore } from '/src/store/editor';
import i18n from '/src/i18n';
import themes from '/src/theme';
import Preferences from '/src/components/Preferences.vue';
const preferences = usePreferencesStore();
const editorStore = useEditorStore();
const editor = createEditor();
watch(editor, value => { if (value) editorStore.setEditor(value); }, { immediate: true });
window.__fontTest = {
  translate(key) { return i18n.global.t(key); },
  async setTheme(kind) { await window.__nativeFontTest.emit('theme', themes.find(theme => theme.value === kind)); await nextTick(); },
  async setLocale(locale) { i18n.global.locale.value = locale; await nextTick(); },
  snapshot() {
    return {
      font: { ...preferences.editorFont }, saving: preferences.savingEditorFont,
      saveError: preferences.editorFontSaveError, syncError: preferences.editorFontSyncError,
      document: editor.value?.getJSON(),
      selection: editor.value ? { from: editor.value.state.selection.from, to: editor.value.state.selection.to } : null,
      undoDepth: editor.value ? undoDepth(editor.value.state) : null,
      redoDepth: editor.value ? redoDepth(editor.value.state) : null,
      editorStyle: editor.value ? { family: getComputedStyle(editor.value.view.dom).fontFamily, size: getComputedStyle(editor.value.view.dom).fontSize } : null,
      chromeFamily: getComputedStyle(document.querySelector('.marknote-preferences')).fontFamily,
    };
  },
  async fixture() {
    editor.value.commands.setContent('# Font fixture\n\nOriginal paragraph\n\n\u0060const untouched = true;\u0060\n');
    const original = editor.value.getJSON();
    editor.value.commands.setTextSelection(17);
    editor.value.view.dispatch(closeHistory(editor.value.state.tr));
    editor.value.commands.insertContent('Edited ');
    await nextTick();
    return original;
  },
  async undo() { const result = editor.value.commands.undo(); await nextTick(); return result; },
  async save(patch) { await preferences.saveEditorFont(patch); await nextTick(); },
};
onBeforeUnmount(() => editorStore.setEditor(undefined));
</script>
<style>html, body { margin: 0; height: 100%; overflow: hidden; }</style>`;

function nativeMock() {
  const callbacks = new Map();
  const listeners = new Map();
  let nextId = 1;
  window.os = 'windows';
  window.isTauri = true;
  localStorage.setItem('lang', localStorage.getItem('lang') || 'en');
  const state = {
    calls: [], storageFailure: false, eventFailure: false,
    async emit(event, payload) {
      for (const [id, listener] of listeners) if (listener.event === event) await callbacks.get(listener.handler)?.({ event, id, payload });
    },
  };
  window.__nativeFontTest = state;
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === 'editorFontPreferences' && state.storageFailure) throw new DOMException('Test storage quota exceeded', 'QuotaExceededError');
    return setItem.call(this, key, value);
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener(_event, id) { listeners.delete(id); } };
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
      if (command === 'plugin:event|listen') {
        const id = nextId++;
        listeners.set(id, { event: args.event, handler: args.handler });
        return id;
      }
      if (command === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
      if (command === 'plugin:event|emit' || command === 'plugin:event|emit_to') {
        if (args.event === 'editorFontPreferences' && state.eventFailure) throw new Error('Test font event failure');
        await state.emit(args.event, args.payload);
        return;
      }
      if (command === 'get_config') return { code: 0, data: {} };
      if (command === 'theme_list') return [];
      if (command === 'plugin:notification|is_permission_granted') return true;
      if (command === 'plugin:notification|request_permission') return 'granted';
      if (command.startsWith('plugin:window|') || command.startsWith('plugin:log|') || command === 'log_error' || command === 'log_info') return;
      throw new Error('Unexpected native command: ' + command);
    },
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.editor-font-browser-test-'));
  const screenshots = process.env.MARKNOTE_EDITOR_FONT_SCREENSHOT_DIR ? path.resolve(process.env.MARKNOTE_EDITOR_FONT_SCREENSHOT_DIR) : null;
  let server, browser, page;
  const errors = [];
  const passed = [];
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';", "import { createPinia } from 'pinia';", "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';", "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';", "import '/src/scss/editor.scss';",
      "import Harness from './Harness.vue';", "const app = createApp(Harness);",
      "app.config.errorHandler = error => { window.__vueTestErrors ||= []; window.__vueTestErrors.push(String(error)); };",
      "app.use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Editor font browser test</title></head><body><div data-tauri-drag-region id="marknote-titlbar" class="marknote-titlbar"></div><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const stubId = '\0editor-font-unrelated-tab';
    const config = {
      root, configFile: false,
      plugins: [{ name: 'editor-font-test-unrelated-tabs', enforce: 'pre', resolveId(source, importer) {
        if (importer?.replaceAll('\\', '/').endsWith('/src/components/Preferences.vue') && /^\.\/preferences\/(General|Markdown|Theme|Image)\.vue$/.test(source)) return stubId;
      }, load(id) { if (id === stubId) return "export default { template: '<div data-unrelated-settings-stub></div>' };"; } }, vue()],
      build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } },
      preview: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error',
    };
    console.log('Building isolated editor font browser harness');
    await build(config);
    server = await preview(config);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    page = await browser.newPage({ viewport: { width: 1100, height: 780 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => { errors.push(error.message); console.error(`Page error: ${error.message}`); });
    await page.addInitScript(nativeMock);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__fontTest?.snapshot().editorStyle));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__fontTest[method](argument), { method, argument });
    const label = key => api('translate', key);
    const record = text => { passed.push(text); console.log(`PASS ${text}`); };
    const tab = async () => page.locator('.preferences-router').getByRole('button', { name: await label('editor'), exact: true }).click();
    const familyControl = async () => page.getByRole('combobox', { name: await label('fontFamily'), exact: true });
    const sizeControl = async () => page.getByRole('spinbutton', { name: await label('fontSize'), exact: true });
    const idle = async expected => page.waitForFunction(expected => {
      const state = window.__fontTest.snapshot();
      return !state.saving && Object.entries(expected || {}).every(([key, value]) => state.font[key] === value);
    }, expected);
    const chooseFamily = async index => {
      await (await familyControl()).click();
      const options = page.getByRole('option');
      await options.nth(index).click();
    };
    const setSize = async size => {
      await (await sizeControl()).fill(String(size));
      await (await sizeControl()).press('Enter');
      await (await sizeControl()).blur();
    };
    const unchanged = async baseline => {
      const state = await api('snapshot');
      for (const key of ['document', 'selection', 'undoDepth', 'redoDepth']) assert.deepEqual(state[key], baseline[key], `Font setting must preserve ${key}`);
      assert.equal(state.chromeFamily, baseline.chromeFamily, 'Editor fonts must not change application chrome');
    };
    await tab();
    assert.notEqual(await label('fontFamily'), 'fontFamily');
    assert.notEqual(await label('fontSize'), 'fontSize');
    await (await familyControl()).waitFor();
    await (await sizeControl()).waitFor();
    assert.equal(await (await familyControl()).getAttribute('aria-describedby'), 'editor-font-hint');
    assert.equal(await (await sizeControl()).getAttribute('aria-describedby'), 'editor-font-size-hint');
    assert.deepEqual((await api('snapshot')).font, { fontFamily: 'system', fontSize: 16 });
    assert.equal((await api('snapshot')).editorStyle.size, '16px');
    assert.equal(await (await sizeControl()).getAttribute('aria-valuemin'), '12');
    assert.equal(await (await sizeControl()).getAttribute('aria-valuemax'), '32');
    record('English font settings expose labeled controls, bounded sizes and system/16px defaults');

    const originalDocument = await api('fixture');
    const baseline = await api('snapshot');
    assert.ok(baseline.undoDepth > 0, 'Fixture must contain a real undo entry');
    await chooseFamily(3);
    await idle({ fontFamily: 'monospace' });
    assert.match((await api('snapshot')).editorStyle.family, /monospace/);
    assert.match(await page.locator('.editor-font-preview').evaluate(element => getComputedStyle(element).fontFamily), /monospace/);
    await unchanged(baseline);
    record('Monospace selection updates the actual editor and preview without changing document, history or chrome');

    await setSize(24);
    await idle({ fontSize: 24 });
    assert.equal((await api('snapshot')).editorStyle.size, '24px');
    assert.equal(await page.locator('.editor-font-preview').evaluate(element => getComputedStyle(element).fontSize), '24px');
    await unchanged(baseline);
    record('Font size applies immediately to the editor and preview while retaining its selection');

    const customFont = 'MarkNote Test Local Font';
    await (await familyControl()).click();
    await (await familyControl()).fill(customFont);
    await page.getByRole('option', { name: customFont, exact: true }).waitFor();
    await (await familyControl()).press('Enter');
    await idle({ fontFamily: customFont });
    assert.ok((await api('snapshot')).editorStyle.family.includes(customFont));
    assert.ok((await api('snapshot')).editorStyle.family.includes('sans-serif'), 'Unavailable custom fonts need a system fallback');
    await unchanged(baseline);
    record('A typed local font name is retained with a fallback stack and no document mutation');
    const beforeCancel = await page.evaluate(() => localStorage.getItem('editorFontPreferences'));
    await (await familyControl()).click();
    await (await familyControl()).fill('Discarded Local Font');
    await page.getByRole('option', { name: 'Discarded Local Font', exact: true }).waitFor();
    await (await familyControl()).press('Escape');
    await page.locator('.editor-font-settings .header').click();
    assert.equal((await api('snapshot')).font.fontFamily, customFont);
    assert.equal(await (await familyControl()).inputValue(), customFont);
    assert.equal(await page.evaluate(() => localStorage.getItem('editorFontPreferences')), beforeCancel);
    await unchanged(baseline);
    record('Leaving an uncommitted custom font search keeps the current font and saved preference');

    const beforeFailure = await api('snapshot');
    const beforeSaved = await page.evaluate(() => localStorage.getItem('editorFontPreferences'));
    await page.evaluate(() => { window.__nativeFontTest.storageFailure = true; });
    await chooseFamily(2);
    await page.waitForFunction(() => Boolean(window.__fontTest.snapshot().saveError));
    assert.deepEqual((await api('snapshot')).font, beforeFailure.font);
    assert.deepEqual((await api('snapshot')).editorStyle, beforeFailure.editorStyle);
    assert.equal(await (await familyControl()).inputValue(), customFont, 'A failed font selection must display the retained font');
    assert.equal(await page.evaluate(() => localStorage.getItem('editorFontPreferences')), beforeSaved);
    await page.getByText(await label('editorFontSaveFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__nativeFontTest.storageFailure = false; });
    await page.getByRole('button', { name: await label('retry'), exact: true }).click();
    await idle({ fontFamily: 'serif' });
    assert.equal((await api('snapshot')).saveError, null);
    await unchanged(baseline);
    record('Failed persistence keeps the current font and saved settings; Retry applies the requested font');
    await page.evaluate(() => { window.__nativeFontTest.storageFailure = true; });
    await (await sizeControl()).focus();
    await (await sizeControl()).press('ArrowDown');
    await page.waitForFunction(() => Boolean(window.__fontTest.snapshot().saveError));
    assert.equal((await api('snapshot')).font.fontSize, 24);
    await page.waitForFunction(() => document.getElementById('editor-font-size')?.value === '24');
    assert.equal(await (await sizeControl()).inputValue(), '24', 'A failed size change must display the retained saved size');
    assert.equal(await (await sizeControl()).evaluate(element => element === document.activeElement), true, 'Failed size persistence must retain input focus');
    await page.evaluate(() => { window.__nativeFontTest.storageFailure = false; });
    await page.getByRole('button', { name: await label('retry'), exact: true }).click();
    await idle({ fontSize: 23 });
    assert.equal(await (await sizeControl()).inputValue(), '23');
    await unchanged(baseline);
    record('A failed font size rolls the numeric control back and Retry restores the requested size');
    const beforeClear = await page.evaluate(() => localStorage.getItem('editorFontPreferences'));
    await (await sizeControl()).fill('');
    await (await sizeControl()).press('Enter');
    await (await sizeControl()).blur();
    await idle({ fontSize: 23 });
    assert.equal(await (await sizeControl()).inputValue(), '23');
    assert.equal(await page.evaluate(() => localStorage.getItem('editorFontPreferences')), beforeClear);
    assert.equal((await api('snapshot')).saveError, null);
    record('Clearing the numeric font size restores the saved size without changing its preference');
    const beforeInvalid = await page.evaluate(() => localStorage.getItem('editorFontPreferences'));
    await (await familyControl()).click();
    await (await familyControl()).fill('Bad; font-name');
    await page.getByRole('option', { name: 'Bad; font-name', exact: true }).click();
    await page.waitForFunction(() => window.__fontTest.snapshot().saveError === 'invalid');
    assert.equal((await api('snapshot')).font.fontFamily, 'serif');
    assert.equal(await page.evaluate(() => localStorage.getItem('editorFontPreferences')), beforeInvalid);
    await page.getByText(await label('editorFontInvalid'), { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: await label('retry'), exact: true }).count(), 0, 'Invalid font names must require a corrected selection');
    await chooseFamily(1);
    await idle({ fontFamily: 'sans-serif' });
    assert.equal((await api('snapshot')).saveError, null);
    await unchanged(baseline);
    record('An invalid font name leaves the current font intact and a corrected selection clears the error');

    await page.evaluate(() => { window.__nativeFontTest.eventFailure = true; });
    await setSize(22);
    await idle({ fontSize: 22 });
    assert.ok((await api('snapshot')).syncError);
    assert.equal((await api('snapshot')).saveError, null);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('editorFontPreferences'))).fontSize, 22);
    await page.getByText(await label('editorFontSyncFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__nativeFontTest.eventFailure = false; });
    await page.getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => !window.__fontTest.snapshot().syncError && !window.__fontTest.snapshot().saving);
    await unchanged(baseline);
    record('A failed cross-window broadcast reports synchronization separately from the successful save and can retry');

    await page.evaluate(() => window.__nativeFontTest.emit('editorFontPreferences', { fontFamily: 'sans-serif', fontSize: 20 }));
    await idle({ fontFamily: 'sans-serif', fontSize: 20 });
    assert.equal((await api('snapshot')).editorStyle.size, '20px');
    await unchanged(baseline);
    record('Incoming native font events update editor style without resetting content or undo history');

    await page.evaluate(() => {
      const next = { fontFamily: 'monospace', fontSize: 18 };
      localStorage.setItem('editorFontPreferences', JSON.stringify(next));
      dispatchEvent(new StorageEvent('storage', { key: 'editorFontPreferences', newValue: JSON.stringify(next), storageArea: localStorage }));
    });
    await idle({ fontFamily: 'monospace', fontSize: 18 });
    await unchanged(baseline);
    record('Storage events also synchronize the font for another open window');

    assert.equal(await api('undo'), true);
    assert.deepEqual((await api('snapshot')).document, originalDocument);
    record('Undo after preference changes still reverses the original text edit');

    await api('save', { fontFamily: customFont, fontSize: 26 });
    await idle({ fontFamily: customFont, fontSize: 26 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__fontTest?.snapshot().editorStyle?.size === '26px');
    await tab();
    assert.deepEqual((await api('snapshot')).font, { fontFamily: customFont, fontSize: 26 });
    assert.ok((await api('snapshot')).editorStyle.family.includes(customFont));
    record('A custom font and size survive a complete preferences-window reload');

    await page.getByRole('button', { name: await label('restoreEditorFontDefaults'), exact: true }).click();
    await idle({ fontFamily: 'system', fontSize: 16 });
    assert.equal((await api('snapshot')).editorStyle.size, '16px');
    assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('editorFontPreferences'))), { fontFamily: 'system', fontSize: 16 });
    record('Restore defaults persists and applies system/16px settings');
    const themeGeometry = async () => page.locator('.editor-font-preview').evaluate(element => {
      const style = getComputedStyle(element);
      const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = channels => channels.map(channel => {
        const value = channel / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const foreground = luminance(rgb(style.color));
      const backgroundColor = getComputedStyle(document.body).backgroundColor;
      const background = luminance(rgb(backgroundColor));
      return { width: element.scrollWidth, available: element.clientWidth, backgroundColor, contrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
    });
    await api('setTheme', 'light');
    const lightGeometry = await themeGeometry();
    assert.ok(lightGeometry.width <= lightGeometry.available + 1);
    assert.ok(lightGeometry.contrast >= 4.5, 'Light-theme font preview should have readable text contrast');
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: path.join(screenshots, 'editor-font-english-light.png') });
    }
    await api('setTheme', 'dark');
    const darkGeometry = await themeGeometry();
    assert.ok(darkGeometry.width <= darkGeometry.available + 1);
    assert.ok(darkGeometry.contrast >= 4.5, 'Dark-theme font preview should have readable text contrast');
    assert.notEqual(darkGeometry.backgroundColor, lightGeometry.backgroundColor);
    assert.deepEqual((await api('snapshot')).font, { fontFamily: 'system', fontSize: 16 });
    if (screenshots) await page.screenshot({ path: path.join(screenshots, 'editor-font-english-dark.png') });
    await api('setTheme', 'light');
    record('English light and dark font previews retain their preference, fit the column and have readable contrast');

    await api('setLocale', 'zhCn');
    await page.setViewportSize({ width: 560, height: 620 });
    assert.match(await label('fontFamily'), /\p{Script=Han}/u);
    assert.match(await label('fontSize'), /\p{Script=Han}/u);
    assert.match(await label('restoreEditorFontDefaults'), /\p{Script=Han}/u);
    await (await familyControl()).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await idle();
    assert.notEqual((await api('snapshot')).font.fontFamily, 'system', 'Keyboard navigation must select a font');
    await (await sizeControl()).focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    await idle({ fontSize: 17 });
    const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, preview: document.querySelector('.editor-font-preview').getBoundingClientRect().width }));
    assert.ok(geometry.width <= geometry.viewport + 1, 'Font settings must fit the narrow window');
    assert.ok(geometry.preview <= geometry.viewport - 130, 'Font preview must fit the settings column');
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: path.join(screenshots, 'editor-font-narrow-chinese.png') });
    }
    record('Chinese labels, keyboard font and size selection and the narrow settings layout work');

    await page.evaluate(() => localStorage.setItem('editorFontPreferences', '{bad-json'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__fontTest?.snapshot().editorStyle));
    assert.deepEqual((await api('snapshot')).font, { fontFamily: 'system', fontSize: 16 });
    record('Malformed saved font JSON falls back to usable defaults without blocking the window');

    assert.deepEqual(errors, [], 'Browser should have no uncaught errors');
    assert.deepEqual(await page.evaluate(() => window.__vueTestErrors || []), [], 'Vue should not report render or event errors');
    console.log(`editor font browser regression: ${passed.length} checks passed`);
  } catch (error) {
    console.error(`Editor font test failed after ${passed.length} checks:`, error);
    if (page && screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: path.join(screenshots, 'editor-font-failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(screenshots, 'editor-font-failure.html'), await page.content().catch(() => ''));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) === root && path.basename(resolved).startsWith('.editor-font-browser-test-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
