/* Real Preferences, shortcut runtime and TipTap editor; only native IPC is mocked. */
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
  <div id="test-runtime"><input id="ordinary-input" aria-label="Ordinary input"><EditorContent :editor="editor" /></div>
</template>
<script setup>
import { nextTick, watch, onBeforeUnmount } from 'vue';
import { EditorContent } from '@tiptap/vue-3';
import { closeHistory } from '@tiptap/pm/history';
import { createEditor } from '/src/utils/editor';
import { usePreferencesStore } from '/src/store/preferences';
import { useEditorStore } from '/src/store/editor';
import { useAppStore } from '/src/store/app';
import { SHORTCUT_DEFINITIONS } from '/src/utils/shortcutPreferences';
import { findThemeByType, setTheme } from '/src/theme';
import i18n from '/src/i18n';
import Preferences from '/src/components/Preferences.vue';
const preferences = usePreferencesStore();
const editorStore = useEditorStore();
const app = useAppStore();
const editor = createEditor();
const commands = [];
app.keyBinding.on(binding => { commands.push(binding.description.join('.')); return true; });
watch(editor, value => { if (value) editorStore.setEditor(value); }, { immediate: true });
window.__shortcutsTest = {
  translate(key) { return i18n.global.t(key); },
  async setLocale(locale) { i18n.global.locale.value = locale; await nextTick(); },
  async runtime(visible) { document.body.classList.toggle('show-runtime', visible); await nextTick(); },
  async theme(type) { app.theme = findThemeByType(type); setTheme(app.theme); await nextTick(); },
  snapshot() {
    return { shortcuts: { ...preferences.shortcuts }, loaded: preferences.shortcutsLoaded,
      loading: preferences.loadingShortcuts, saving: preferences.savingShortcuts,
      loadError: preferences.shortcutLoadError, saveError: preferences.shortcutSaveError, syncError: preferences.shortcutSyncError,
      definitions: SHORTCUT_DEFINITIONS, commands: [...commands], document: editor.value?.getJSON(),
      text: editor.value?.getText(), bold: editor.value?.isActive('bold'), italic: editor.value?.isActive('italic'),
      hint: app.keyBinding.getKey('format.bold')?.key };
  },
  async prepare() { editor.value.commands.setContent('<p>Alpha</p>'); editor.value.commands.setTextSelection({ from: 1, to: 6 }); editor.value.commands.focus(); await nextTick(); },
  async undoFixture() {
    editor.value.commands.setContent('<p>one</p>'); editor.value.commands.setTextSelection(4);
    editor.value.view.dispatch(closeHistory(editor.value.state.tr));
    editor.value.commands.insertContent(' two');
    editor.value.view.dispatch(closeHistory(editor.value.state.tr));
    editor.value.commands.insertContent(' three'); editor.value.commands.focus(); await nextTick();
  },
  async load() { preferences.shortcutsLoaded = false; try { await preferences.loadShortcutPreferences(); return null; } catch(error) { return String(error); } },
};
onBeforeUnmount(() => { app.keyBinding.unbind(); editorStore.setEditor(undefined); });
</script>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; }
#test-runtime { display: none; }
body.show-runtime .marknote-preferences { display: none; }
body.show-runtime #test-runtime { display: block; padding: 20px; }
#test-runtime .ProseMirror { min-height: 240px; border: 1px solid #aaa; }
</style>`;

function nativeMock() {
  const callbacks = new Map();
  const listeners = new Map();
  let nextId = 1;
  window.os = 'windows';
  window.isTauri = true;
  localStorage.setItem('lang', localStorage.getItem('lang') || 'en');
  const state = {
    calls: [], shortcuts: JSON.parse(localStorage.getItem('__test_shortcuts_db') || 'null'),
    loadFailure: false, saveFailure: false, eventFailure: null, delayed: null, delayCommand: null,
    async emit(event, payload) {
      for (const [id, listener] of listeners) if (listener.event === event) await callbacks.get(listener.handler)?.({ event, id, payload });
    },
    release() { this.delayed?.(); this.delayed = null; },
  };
  window.__nativeTest = state;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener(event, id) { listeners.delete(id); } };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'preferences' }, currentWebview: { label: 'preferences' } },
    transformCallback(callback, once = false) {
      const id = nextId++; callbacks.set(id, value => { if (once) callbacks.delete(id); return callback(value); }); return id;
    },
    unregisterCallback(id) { callbacks.delete(id); }, convertFileSrc(value) { return value; },
    async invoke(command, args = {}) {
      state.calls.push({ command, args: JSON.parse(JSON.stringify(args)) });
      if (state.delayCommand === command) { state.delayCommand = null; await new Promise(resolve => { state.delayed = resolve; }); }
      if (command === 'plugin:event|listen') { const id = nextId++; listeners.set(id, { event: args.event, handler: args.handler }); return id; }
      if (command === 'plugin:event|unlisten') { listeners.delete(args.eventId); return; }
      if (command === 'plugin:event|emit' || command === 'plugin:event|emit_to') {
        if (state.eventFailure === args.event) throw new Error('Test event channel failure');
        await state.emit(args.event, args.payload); return;
      }
      if (command === 'get_config') return state.loadFailure ? { code: 1, info: 'Test database read failure' }
        : { code: 0, data: state.shortcuts ? { shortcut_preferences: JSON.stringify(state.shortcuts) } : {} };
      if (command === 'save_shortcut_preferences') {
        if (state.saveFailure) return { code: 1, info: 'Test database write failure' };
        state.shortcuts = args.options; localStorage.setItem('__test_shortcuts_db', JSON.stringify(state.shortcuts)); return { code: 0, info: '' };
      }
      if (command === 'plugin:notification|is_permission_granted') return true;
      if (command === 'plugin:notification|request_permission') return 'granted';
      if (command === 'theme_list') return [];
      if (command.startsWith('plugin:window|') || command.startsWith('plugin:log|') || command === 'log_error' || command === 'log_info') return;
      throw new Error('Unexpected native command: ' + command);
    },
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.shortcuts-browser-test-'));
  const screenshots = process.env.MARKNOTE_SHORTCUTS_SCREENSHOT_DIR ? path.resolve(process.env.MARKNOTE_SHORTCUTS_SCREENSHOT_DIR) : null;
  let server, browser, page;
  const errors = [], passed = [];
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';", "import { createPinia } from 'pinia';", "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';", "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';",
      "import Harness from './Harness.vue';", "const app = createApp(Harness);",
      "app.config.errorHandler = error => { console.error(error); window.__vueTestErrors ||= []; window.__vueTestErrors.push(String(error)); };",
      "app.use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Shortcuts browser test</title></head><body><div data-tauri-drag-region id="marknote-titlbar" class="marknote-titlbar"></div><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const stubId = '\0shortcuts-test-unrelated-tabs';
    const config = {
      root, configFile: false,
      plugins: [{ name: 'shortcuts-test-unrelated-tabs', enforce: 'pre', resolveId(source, importer) {
        if (importer?.replaceAll('\\', '/').endsWith('/src/components/Preferences.vue') && /^\.\/preferences\/(General|Editor|Image|Markdown|Theme)\.vue$/.test(source)) return stubId;
      }, load(id) { if (id === stubId) return "export default { template: '<div data-unrelated-settings-stub></div>' };"; } }, vue()],
      build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } },
      preview: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error',
    };
    console.log('Building isolated shortcuts browser harness');
    await build(config); server = await preview(config);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    page = await browser.newPage({ viewport: { width: 1100, height: 780 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => { errors.push(error.message); console.error(`Page error: ${error.message}`); });
    await page.addInitScript(nativeMock); await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__shortcutsTest?.snapshot().document));
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__shortcutsTest[method](argument), { method, argument });
    const native = patch => page.evaluate(patch => Object.assign(window.__nativeTest, patch), patch);
    const calls = command => page.evaluate(command => window.__nativeTest.calls.filter(call => call.command === command), command);
    const label = key => api('translate', key);
    const record = message => { passed.push(message); console.log(`PASS ${message}`); };
    const qaScreenshot = async name => {
      await page.evaluate(() => { const shell = document.querySelector('.preferences'); if (shell) shell.scrollTop = 0; });
      await page.screenshot({ path: path.join(screenshots, name) });
    };
    const input = id => page.locator(`#shortcut-${id.replaceAll('.', '-')}`);
    const row = id => page.locator(`[data-shortcut-id="${id}"]`);
    const save = async () => {
      await page.getByRole('button', { name: await label('shortcutSave'), exact: true }).first().click();
      await page.waitForFunction(() => !window.__shortcutsTest.snapshot().saving);
    };
    const capture = async (id, keys) => { await input(id).focus(); await page.keyboard.press(keys); await input(id).blur(); };
    const rowAction = async (id, key) => row(id).locator('button').filter({ hasText: await label(key) }).click();
    const pressEditor = async keys => { await api('runtime', true); await api('prepare'); await page.locator('.ProseMirror').focus(); await page.keyboard.press(keys); };
    await page.locator('.preferences-router').getByRole('button', { name: await label('shortcuts'), exact: true }).click();
    await input('format.bold').waitFor();
    await page.waitForFunction(() => window.__shortcutsTest.snapshot().loaded);
    const initial = (await api('snapshot')).shortcuts;
    assert.equal(await input('format.bold').getAttribute('readonly'), '');
    assert.equal(await input('format.bold').inputValue(), 'Ctrl+B');
    assert.equal(await page.locator('[data-shortcut-id]').count(), (await api('snapshot')).definitions.length);
    assert.notEqual(await label('shortcutSave'), 'shortcutSave');
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await qaScreenshot('shortcuts-english-light.png');
    }
    record('Shortcuts tab renders translated settings and persisted defaults for all supported commands');

    const commandCount = (await api('snapshot')).commands.length;
    await input('format.bold').focus();
    await page.keyboard.press('Control+s');
    assert.equal((await api('snapshot')).commands.length, commandCount, 'recording never invokes file actions');
    assert.equal((await api('snapshot')).shortcuts['format.bold'], initial['format.bold'], 'recording modifies the draft only');
    const recordedValue = await input('format.bold').inputValue();
    for (const event of [{ key: 'Process', code: 'Period', ctrlKey: true, keyCode: 229 }, { key: 'b', code: 'KeyB', ctrlKey: true, isComposing: true }]) {
      await input('format.bold').dispatchEvent('keydown', event);
      assert.equal(await input('format.bold').inputValue(), recordedValue);
    }
    await input('format.bold').blur();
    await rowAction('format.bold', 'shortcutReset');
    record('key recording changes only the draft, suppresses commands and ignores IME composition');

    await capture('format.bold', 'Control+i');
    assert.equal(await input('format.bold').getAttribute('aria-invalid'), 'true');
    const beforeConflict = (await calls('save_shortcut_preferences')).length;
    await page.getByRole('button', { name: await label('shortcutSave'), exact: true }).first().dispatchEvent('click');
    assert.equal((await calls('save_shortcut_preferences')).length, beforeConflict);
    await capture('format.italic', 'Control+b');
    assert.notEqual(await input('format.bold').getAttribute('aria-invalid'), 'true');
    await save();
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+I');
    assert.equal((await api('snapshot')).shortcuts['format.italic'], 'Mod+B');
    record('conflicts prevent writes, and swapping two bindings succeeds when the complete draft is valid');

    await capture('format.bold', 'Control+Shift+k');
    await native({ saveFailure: true }); await save();
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+I');
    assert.match(await input('format.bold').inputValue(), /Shift.*K/);
    await page.getByRole('alert').filter({ hasText: await label('shortcutSaveFailed') }).waitFor();
    await native({ saveFailure: false }); await save();
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+Shift+K');
    assert.equal((await api('snapshot')).hint, 'Mod+Shift+K');
    record('save failure retains the editable draft and active binding; retry persists and refreshes runtime hints');

    await pressEditor('Control+Shift+k');
    assert.equal((await api('snapshot')).bold, true, 'new bold shortcut toggles exactly once');
    await pressEditor('Control+i');
    assert.equal((await api('snapshot')).bold, false, 'old bold binding has been removed');
    await api('runtime', false);
    await rowAction('format.italic', 'shortcutReset'); await save();
    await pressEditor('Control+b');
    assert.equal((await api('snapshot')).bold, false, 'original TipTap bold binding must be suppressed after remapping');
    await api('undoFixture'); await page.keyboard.press('Control+z');
    assert.equal((await api('snapshot')).text, 'one two', 'undo must execute once');
    await page.keyboard.press('Control+y');
    assert.equal((await api('snapshot')).text, 'one two three', 'redo must execute once');
    const editorCommands = (await api('snapshot')).commands.length;
    await page.keyboard.press('Control+s');
    assert.equal((await api('snapshot')).commands.length, editorCommands + 1);
    await page.locator('#ordinary-input').focus(); await page.keyboard.press('Control+s');
    assert.equal((await api('snapshot')).commands.length, editorCommands + 1, 'ordinary inputs keep browser and editing shortcuts');
    await api('prepare');
    for (const event of [{ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true, isComposing: true }, { key: 'Process', code: 'KeyK', ctrlKey: true, shiftKey: true, keyCode: 229 }]) {
      await page.locator('.ProseMirror').dispatchEvent('keydown', event);
      assert.equal((await api('snapshot')).bold, false);
    }
    record('actual editor honors remapping, removes original keys, performs one undo/redo and ignores ordinary inputs/IME');

    await api('runtime', false);
    await rowAction('format.bold', 'shortcutClear'); await save();
    assert.equal((await api('snapshot')).shortcuts['format.bold'], '');
    await pressEditor('Control+Shift+k'); assert.equal((await api('snapshot')).bold, false);
    await pressEditor('Control+b'); assert.equal((await api('snapshot')).bold, false);
    await api('runtime', false);
    await rowAction('format.bold', 'shortcutReset'); await save();
    await pressEditor('Control+b'); assert.equal((await api('snapshot')).bold, true);
    await api('runtime', false);
    await capture('format.bold', 'Control+Shift+k'); await save();
    const persisted = (await api('snapshot')).shortcuts;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__shortcutsTest?.snapshot().loaded && Boolean(window.__shortcutsTest.snapshot().document));
    await page.locator('.preferences-router').getByRole('button', { name: await label('shortcuts'), exact: true }).click();
    assert.deepEqual((await api('snapshot')).shortcuts, persisted);
    await pressEditor('Control+Shift+k'); assert.equal((await api('snapshot')).bold, true);
    await api('runtime', false);
    await page.evaluate(async () => {
      const next = { ...window.__shortcutsTest.snapshot().shortcuts, 'format.bold': 'Mod+Alt+K' };
      await window.__nativeTest.emit('shortcutPreferences', next);
    });
    assert.equal((await api('snapshot')).hint, 'Mod+Alt+K');
    await pressEditor('Control+Alt+k'); assert.equal((await api('snapshot')).bold, true);
    await api('runtime', false);
    record('clear/reset, persisted window reload and external preference broadcasts update the running editor');

    await native({ loadFailure: true }); assert.match(await api('load'), /database read failure/);
    await page.getByRole('alert').filter({ hasText: await label('shortcutLoadFailed') }).waitFor();
    assert.equal(await input('format.bold').isDisabled(), true);
    await native({ loadFailure: false });
    await page.getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__shortcutsTest.snapshot().loaded && !window.__shortcutsTest.snapshot().loading);
    assert.equal(await input('format.bold').isDisabled(), false);
    await capture('format.bold', 'Control+Alt+k');
    await native({ eventFailure: 'shortcutPreferences' }); await save();
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+Alt+K');
    await page.getByRole('alert').filter({ hasText: await label('shortcutSyncFailed') }).waitFor();
    await native({ eventFailure: null });
    await page.getByRole('button', { name: await label('shortcutRestoreDefaults'), exact: true }).click(); await save();
    assert.deepEqual((await api('snapshot')).shortcuts, initial);
    record('database load retry and synchronization errors are recoverable; restore all defaults persists a valid map');

    await capture('format.bold', 'Control+Shift+k');
    await native({ delayCommand: 'save_shortcut_preferences' });
    await page.getByRole('button', { name: await label('shortcutSave'), exact: true }).first().click();
    await page.waitForFunction(() => Boolean(window.__nativeTest.delayed));
    assert.equal(await input('format.bold').isDisabled(), true);
    const pendingWrites = (await calls('save_shortcut_preferences')).length;
    await page.getByRole('button', { name: await label('shortcutSave'), exact: true }).first().dispatchEvent('click');
    await page.evaluate(() => window.__nativeTest.release());
    await page.waitForFunction(() => !window.__shortcutsTest.snapshot().saving);
    assert.equal((await calls('save_shortcut_preferences')).length, pendingWrites);
    await api('setLocale', 'zhCn');
    if (screenshots) await qaScreenshot('shortcuts-chinese-light.png');
    await api('theme', 'dark');
    await page.setViewportSize({ width: 560, height: 620 });
    assert.match(await label('shortcutSave'), /\p{Script=Han}/u);
    await capture('paragraph.mathBlock', 'Control+Meta+Alt+Shift+k');
    await input('paragraph.mathBlock').scrollIntoViewIfNeeded();
    assert.ok(await input('paragraph.mathBlock').isVisible());
    const longBinding = await input('paragraph.mathBlock').evaluate(element => {
      const style = getComputedStyle(element);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d'); context.font = style.font;
      return { text: element.value, width: context.measureText(element.value).width,
        available: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
    });
    assert.match(longBinding.text, /Ctrl\+(?:Win|Meta)\+Alt\+Shift\+K/);
    assert.ok(longBinding.width <= longBinding.available + 1, 'long key combinations fit the capture field');
    console.log(`Long shortcut: ${longBinding.width.toFixed(1)}px text in ${longBinding.available.toFixed(1)}px input content width`);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('dark')));
    const geometry = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(geometry.width <= geometry.viewport + 1, 'shortcut settings fit a narrow window');
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await qaScreenshot('shortcuts-narrow-chinese-dark.png');
    }
    record('busy saves prevent competing writes; Chinese settings remain usable in narrow windows and dark themes');

    await rowAction('paragraph.mathBlock', 'shortcutReset');

    await api('setLocale', 'en');
    await page.setViewportSize({ width: 1100, height: 780 });
    await capture('format.bold', 'Control+Alt+k');
    const requestClose = () => page.evaluate(() => {
      window.__nativeTest.closeFinished = false;
      window.__nativeTest.closeRequest = window.__nativeTest.emit('tauri://close-requested', null)
        .then(() => { window.__nativeTest.closeFinished = true; });
    });
    const closedRequest = async () => {
      await page.waitForFunction(() => window.__nativeTest.closeFinished);
      await page.waitForFunction(() => [...document.querySelectorAll('.el-overlay-message-box')].every(element => !element.getClientRects().length));
    };
    const closeCommands = async () => (await calls('plugin:window|close')).length + (await calls('plugin:window|destroy')).length;
    const closesBefore = await closeCommands();
    await page.locator('.preferences-router').getByRole('button', { name: await label('general'), exact: true }).click();
    await native({ saveFailure: true }); await requestClose();
    const closeDialog = page.getByRole('dialog').filter({ hasText: await label('shortcutUnsavedClose') });
    await closeDialog.getByRole('button', { name: await label('shortcutSave'), exact: true }).click();
    await closedRequest();
    assert.equal(await closeCommands(), closesBefore, 'saving from a different tab must keep the window open when persistence fails');
    assert.equal(await page.locator('.preferences-shortcuts').isVisible(), true, 'failed close-save reveals shortcut settings');
    assert.equal(await page.getByRole('alert').filter({ hasText: await label('shortcutSaveFailed') }).isVisible(), true);
    await native({ saveFailure: false });
    await capture('format.bold', 'Control+i');
    await page.locator('.preferences-router').getByRole('button', { name: await label('general'), exact: true }).click();
    const writesBeforeCloseConflict = (await calls('save_shortcut_preferences')).length;
    await requestClose();
    await closeDialog.getByRole('button', { name: await label('shortcutSave'), exact: true }).click();
    await closedRequest();
    assert.equal(await closeCommands(), closesBefore, 'conflicts prevent closing from another tab');
    assert.equal((await calls('save_shortcut_preferences')).length, writesBeforeCloseConflict);
    assert.equal(await page.locator('.preferences-shortcuts').isVisible(), true);
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-invalid') === 'true');
    assert.equal(await page.locator('.shortcut-field-error').first().isVisible(), true, 'close-save makes conflicting fields visible and focuses an invalid field');
    await capture('format.bold', 'Control+Alt+k');
    await requestClose();
    await page.getByRole('dialog').filter({ hasText: await label('shortcutUnsavedClose') }).waitFor();
    await page.keyboard.press('Escape'); await closedRequest();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await closeCommands(), closesBefore, 'Escape keeps the preferences window open');
    assert.match(await input('format.bold').inputValue(), /Alt.*K/, 'cancelling close retains the draft');
    await native({ saveFailure: true }); await requestClose();
    await closeDialog.getByRole('button', { name: await label('shortcutSave'), exact: true }).click();
    await closedRequest();
    assert.equal(await closeCommands(), closesBefore, 'failed close-save keeps the window open');
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+Shift+K');
    assert.match(await input('format.bold').inputValue(), /Alt.*K/);
    await native({ saveFailure: false }); await requestClose();
    await closeDialog.getByRole('button', { name: await label('shortcutSave'), exact: true }).click();
    await closedRequest();
    assert.equal(await closeCommands(), closesBefore + 1);
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+Alt+K');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__shortcutsTest?.snapshot().loaded);
    await page.locator('.preferences-router').getByRole('button', { name: await label('shortcuts'), exact: true }).click();
    await capture('format.bold', 'Control+Shift+k');
    const writesBeforeDiscard = (await calls('save_shortcut_preferences')).length;
    const closesBeforeDiscard = await closeCommands();
    await requestClose();
    await page.getByRole('dialog').getByRole('button', { name: await label('shortcutDiscard'), exact: true }).click();
    await closedRequest();
    assert.equal(await closeCommands(), closesBeforeDiscard + 1);
    assert.equal((await calls('save_shortcut_preferences')).length, writesBeforeDiscard);
    assert.equal((await api('snapshot')).shortcuts['format.bold'], 'Mod+Alt+K');
    record('unsaved close prompts reveal save errors/conflicts from other tabs, preserve drafts on Escape/failure, save before closing and discard without writing');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    assert.deepEqual(await page.evaluate(() => window.__vueTestErrors || []), [], 'no Vue render/event errors');
    console.log(`shortcuts browser regression: ${passed.length} checks passed`);
  } catch (error) {
    console.error(`Shortcuts test failed after ${passed.length} checks:`, error);
    if (page && screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: path.join(screenshots, 'shortcuts-failure.png'), fullPage: true }).catch(() => {});
      fs.writeFileSync(path.join(screenshots, 'shortcuts-failure.html'), await page.content().catch(() => ''));
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) === root && path.basename(resolved).startsWith('.shortcuts-browser-test-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
