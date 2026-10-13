/* Real Folder, Sidebar, Image and General components; filesystem, preferences
 * and native picker IPC are simulated. The shared document opener has its own tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const visibilityOnly = process.argv.includes('--sidebar-visibility') || process.env.MARKNOTE_SIDEBAR_VISIBILITY_ONLY === '1';
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
  <ElConfigProvider :locale="elLocale">
    <div v-if="mode === 'sidebar'" class="test-editor-shell">
      <Sidebar v-if="mounted" /><div class="test-document-surface">Current document remains visible</div>
    </div>
    <div v-else class="marknote-preferences"><div class="preferences"><div class="right"><div class="preferences-content"><Image /><General /></div></div></div></div>
    <Preferences v-if="false" />
  </ElConfigProvider>
</template>
<script setup>
import { computed, nextTick, ref } from 'vue';
import { ElConfigProvider } from 'element-plus';
import en from 'element-plus/es/locale/lang/en';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import Sidebar from '/src/components/sidebar/Sidebar.vue';
import Image from '/src/components/preferences/Image.vue';
import General from '/src/components/preferences/General.vue';
import Preferences from '/src/components/Preferences.vue';
import { useAppStore } from '/src/store/app';
import { useMenuStore } from '/src/store/menu';
import { useImagePreferencesStore } from '/src/store/imagePreferences';
import themes, { setTheme } from '/src/theme';
import i18n from '/src/i18n';
const app = useAppStore();
const menu = useMenuStore();
const image = useImagePreferencesStore();
const visibilityMode = new URLSearchParams(location.search).has('sidebarVisibility');
app.loading = false; app.isSave = true; if (!visibilityMode) app.sidebar.visible = true; app.sidebar.active = 'folder';
const initialized = visibilityMode ? app.init() : Promise.resolve();
window.__folderSettingsReady = false;
initialized.then(() => { window.__folderSettingsReady = true; });
const mode = ref('sidebar'); const mounted = ref(true);
const elLocale = computed(() => i18n.global.locale.value === 'zhCn' ? zhCn : en);
app.openMarkdownDocument = async function(path) { window.__folderSettingsNative.opened.push(path); if (window.__folderSettingsNative.openFailure) return 'failed'; return 'opened'; };
window.__folderSettingsTest = {
  translate(key) { return i18n.global.t(key); },
  async mode(value) { mode.value = value; await nextTick(); },
  async locale(value) { i18n.global.locale.value = value; await nextTick(); },
  async theme(kind) { const value = themes.find(theme => theme.value === kind); app.theme = value; setTheme(value); await nextTick(); },
  async folder(value) { app.folder = value; await nextTick(); },
  async openFolder() { menu.setKey({ key: 'openFolder', label: i18n.global.t('openFolder') }); await nextTick(); },
  async mount(value) { mounted.value = value; await nextTick(); },
  async busy(value) { app.lifecycleBusy = value; await nextTick(); },
  async sidebarVisible(value) { await initialized; app.sidebar.visible = value; await nextTick(); },
  snapshot() { return { width: app.sidebar.width, storedWidth: localStorage.getItem('sidebarWidth'), storedVisible: localStorage.getItem('sidebarVisible'), active: app.sidebar.active, folder: app.folder,
    image: { type: image.saveType, path: image.path, loaded: image.loaded, loading: image.loading, saving: image.saving, saved: image.saved, error: image.errorKey, invalid: image.invalidPathKey },
    cursor: document.body.style.cursor, sidebarVisible: app.sidebar.visible, granted: app.permissionGranted }; },
};
</script>
<style>
html,body { margin:0; height:100%; overflow:hidden; font-family:var(--fontFamily); }
.test-editor-shell { height:100vh; display:flex; min-width:0; }
.test-document-surface { flex:1; min-width:90px; padding-top:50px; overflow-wrap:anywhere; color:var(--contentTextColor); background:var(--contentBackgroundColor); }
.marknote-preferences .preferences { top:0; padding-top:0; }
.marknote-preferences .preferences > .right { padding-top:0; }
.marknote-preferences .preferences-content { padding:12px 20px; box-sizing:border-box; }
</style>`;

function nativeMock() {
  window.os = 'windows'; window.isTauri = true;
  localStorage.setItem('lang', 'en'); if (localStorage.getItem('sidebarWidth') === null) localStorage.setItem('sidebarWidth', '420');
  const visibilityMode = new URLSearchParams(location.search).has('sidebarVisibility');
  const state = { calls: [], picks: [], opened: [], openFailure: false, failDirectory: null, delayedDirectory: null, releaseDirectory: null,
    configFailure: !visibilityMode, saveFailure: false, delaySave: false, releaseSave: null, failWidth: false, failVisibility: false, permissionFailure: false,
    config: { image_save_type: 'default', image_save_path: '${filename}.assets' },
    directories: {
      'C:\\notes': [ { name: 'note10.md', dir: false, path: 'C:\\notes\\note10.md' }, { name: 'zFolder', dir: true, path: 'C:\\notes\\zFolder' }, { name: 'Note2.md', dir: false, path: 'C:\\notes\\Note2.md' } ],
      'C:\\notes\\zFolder': [ { name: 'HiddenSecret.md', dir: false, path: 'C:\\notes\\zFolder\\HiddenSecret.md' } ],
      'C:\\empty': [], 'C:\\slow': [ { name: 'OldResult.md', dir: false, path: 'C:\\slow\\OldResult.md' } ],
      'C:\\other': [ { name: 'CurrentResult.md', dir: false, path: 'C:\\other\\CurrentResult.md' } ],
    },
  };
  window.__folderSettingsNative = state;
  window.Notification.requestPermission = async () => {
    if (state.permissionFailure) throw new Error('Injected permission failure');
    return 'granted';
  };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key === 'sidebarWidth' && state.failWidth) throw new Error('Injected width storage failure');
    if (key === 'sidebarVisible' && state.failVisibility) throw new Error('Injected visibility storage failure');
    return setItem.call(this, key, value);
  };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'preferences' }, currentWebview: { label: 'preferences' } },
    convertFileSrc(value) { return value; }, transformCallback() { return 1; }, unregisterCallback() {},
    async invoke(command, args = {}) {
      state.calls.push({ command, args });
      if (command === 'ls_md') {
        if (state.delayedDirectory === args.path) { state.delayedDirectory = null; await new Promise(resolve => { state.releaseDirectory = resolve; }); }
        if (state.failDirectory === args.path) throw new Error('Injected directory read failure');
        return { code: 0, data: { name: args.path, path: args.path, dir: true, file: false, children: state.directories[args.path] || [] } };
      }
      if (command === 'get_config') return state.configFailure ? { code: 1, info: 'Injected configuration failure' } : { code: 0, data: { ...state.config } };
      if (command === 'theme_list') return [];
      if (command === 'plugin:notification|is_permission_granted') return true;
      if (command === 'save_image_type') {
        if (state.delaySave) { state.delaySave = false; await new Promise(resolve => { state.releaseSave = resolve; }); }
        if (state.saveFailure) return { code: 1, info: 'Injected database write failure' };
        state.config = { image_save_type: args.saveType, image_save_path: args.path }; return { code: 0 };
      }
      if (command === 'plugin:dialog|open') { const selected = state.picks.shift() ?? null; if (selected === 'FAIL_PICKER') throw new Error('Injected native picker failure'); return selected; }
      if (command === 'plugin:notification|request_permission') { if (state.permissionFailure) throw new Error('Injected permission failure'); return 'granted'; }
      if (command.startsWith('plugin:event|') || command.startsWith('plugin:window|') || command.startsWith('plugin:log|') || command === 'log_error') return;
      throw new Error('Unexpected native command: ' + command);
    },
  };
}

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.folder-settings-browser-test-'));
  let server, browser;
  const errors = [];
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';", "import { createPinia } from 'pinia';", "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';", "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';",
      "import loading from '/src/directives/loading';", "import '/src/directives/loading/index.scss';",
      "import Harness from './Harness.vue';", "createApp(Harness).directive('loading', loading).use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:"><title>Folder and settings checks</title></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const config = { root, configFile: false, plugins: [vue()], logLevel: 'error',
      build: { outDir: path.join(temporary, 'dist'), emptyOutDir: true, minify: false, rollupOptions: { input: path.join(temporary, 'index.html') } }, preview: { host: '127.0.0.1', port: 0, strictPort: false } };
    console.log('Building isolated folder/settings browser harness');
    await build(config); server = await preview(config);
    const url = `http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    browser = await chromium.launch({ headless: true, ...browserOptions(chromium) });
    const page = await browser.newPage({ viewport: { width: 1000, height: 780 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000); page.on('pageerror', error => { errors.push(error.message); console.error('Page error:', error.message); });
    await page.addInitScript(nativeMock); await page.goto(url + (visibilityOnly ? '?sidebarVisibility=1' : ''));
    await page.waitForFunction(() => Boolean(window.__folderSettingsTest));
    await page.waitForFunction(() => window.__folderSettingsReady);
    const api = (method, argument) => page.evaluate(({ method, argument }) => window.__folderSettingsTest[method](argument), { method, argument });
    const label = key => api('translate', key);
    const separator = () => page.getByRole('separator');
    const record = message => console.log('PASS ' + message);
    const visibleNames = () => page.locator('.folder-node-name:visible').allTextContents();
    if (visibilityOnly) {
      const reload = async () => { await page.reload(); await page.waitForFunction(() => window.__folderSettingsReady); };
      assert.equal((await api('snapshot')).sidebarVisible, false, 'A fresh store uses the default hidden state');
      assert.equal(await page.locator('.layout-sidebar').count(), 0);
      await api('sidebarVisible', true); assert.equal((await api('snapshot')).storedVisible, 'true');
      await separator().focus(); await separator().press('ArrowLeft'); assert.equal((await api('snapshot')).storedWidth, '410');
      await reload(); assert.equal((await api('snapshot')).sidebarVisible, true); assert.equal((await api('snapshot')).width, 410); await page.locator('.layout-sidebar').waitFor();
      record('Real App state and Sidebar restore a saved visible state and the user-selected width after reload');
      await page.setViewportSize({ width: 280, height: 780 }); await page.waitForFunction(() => window.__folderSettingsTest.snapshot().width === 184);
      assert.equal((await api('snapshot')).storedWidth, '410'); await reload(); assert.equal((await api('snapshot')).width, 184); assert.equal((await api('snapshot')).storedWidth, '410');
      await page.setViewportSize({ width: 1000, height: 780 }); await page.waitForFunction(() => window.__folderSettingsTest.snapshot().width === 410);
      record('A narrow-window reload clamps the rendered width while retaining the preferred width for a wider window');
      await page.getByRole('button', { name: await label('collapseSidebar'), exact: true }).press('Enter'); assert.equal((await api('snapshot')).storedVisible, 'false');
      await reload(); assert.equal((await api('snapshot')).sidebarVisible, false); assert.equal(await page.locator('.layout-sidebar').count(), 0); assert.equal((await api('snapshot')).storedWidth, '410');
      await api('sidebarVisible', true); await page.evaluate(() => { window.__folderSettingsNative.failVisibility = true; }); await api('sidebarVisible', false);
      assert.equal((await api('snapshot')).sidebarVisible, false); assert.equal((await api('snapshot')).storedVisible, 'true', 'Failed storage writes preserve the last saved preference');
      await page.evaluate(() => { window.__folderSettingsNative.failVisibility = false; }); await api('sidebarVisible', true); await api('sidebarVisible', false); assert.equal((await api('snapshot')).storedVisible, 'false');
      record('Keyboard collapse persists hidden state; failed persistence preserves in-memory behavior and recovers on the next successful change');
      await page.evaluate(() => localStorage.setItem('sidebarVisible', 'TRUE')); await reload(); assert.equal((await api('snapshot')).sidebarVisible, false);
      await page.evaluate(() => localStorage.removeItem('sidebarVisible')); await reload(); assert.equal((await api('snapshot')).sidebarVisible, false); assert.equal((await api('snapshot')).width, 410);
      assert.deepEqual(errors, []); console.log('Sidebar visibility browser checks passed'); return;
    }
    assert.equal((await api('snapshot')).width, 420);
    await separator().focus(); await separator().press('ArrowLeft');
    assert.equal((await api('snapshot')).width, 410);
    await separator().press('Shift+ArrowRight'); assert.equal((await api('snapshot')).storedWidth, '450');
    await separator().press('Enter'); assert.equal((await api('snapshot')).width, 220);
    await page.evaluate(() => { window.__folderSettingsNative.failWidth = true; });
    await separator().press('ArrowRight');
    await page.getByText(await label('sidebarWidthSaveFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.failWidth = false; });
    await page.locator('.sidebar-width-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    assert.equal((await api('snapshot')).storedWidth, '230');
    await page.setViewportSize({ width: 280, height: 780 });
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().width === 184);
    assert.equal((await api('snapshot')).storedWidth, '230', 'Viewport clamping must not replace the remembered preference');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1000, height: 780 });
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().width === 230);
    const handle = await separator().boundingBox();
    await page.mouse.move(handle.x + 3, handle.y + 200); await page.mouse.down(); await page.mouse.move(handle.x + 83, handle.y + 200); await page.mouse.up();
    assert.equal((await api('snapshot')).width, 310); assert.equal((await api('snapshot')).cursor, '');
    await page.mouse.move(313, 200); await page.mouse.down(); await api('mount', false);
    assert.equal((await api('snapshot')).cursor, ''); await page.mouse.up(); await api('mount', true);
    await page.getByRole('button', { name: await label('restoreSidebarWidth'), exact: true }).click();
    assert.equal((await api('snapshot')).width, 220);
    await page.getByRole('button', { name: await label('outliner'), exact: true }).press('Enter');
    assert.equal((await api('snapshot')).active, 'outliner');
    await page.getByRole('button', { name: await label('folder'), exact: true }).press('Space');
    assert.equal((await api('snapshot')).active, 'folder');
    record('Sidebar remembers width, supports keyboard/pointer/reset, cleans up on unmount and clamps narrow windows without losing the preferred width');

    await page.getByText(await label('noFolderOpen'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.failDirectory = 'C:\\notes'; });
    await api('folder', 'C:\\notes');
    await page.locator('.folder-error').getByRole('button', { name: await label('retry'), exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.failDirectory = null; });
    await page.locator('.folder-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.folder-node-name').length === 3);
    assert.deepEqual(await visibleNames(), ['zFolder', 'Note2.md', 'note10.md']);
    await api('openFolder'); assert.equal((await api('snapshot')).folder, 'C:\\notes');
    const filter = () => page.getByRole('textbox', { name: '' });
    const filterInput = page.locator('.folder-search input');
    await filterInput.fill('hidden'); await page.getByText(await label('noMatchingLoadedFiles'), { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__folderSettingsNative.calls.some(call => call.command === 'ls_md' && call.args.path.endsWith('zFolder'))), false);
    await page.getByRole('button', { name: await label('clearFolderFilter'), exact: true }).click();
    assert.equal(await filterInput.evaluate(element => document.activeElement === element), true);
    await page.locator('.folder-node-name').filter({ hasText: 'zFolder' }).click();
    await page.locator('.folder-node-name').filter({ hasText: 'HiddenSecret.md' }).waitFor({ state: 'visible' });
    await page.locator('.folder-node-name').filter({ hasText: 'zFolder' }).click();
    await filterInput.fill('HIDDENSECRET');
    await page.locator('.folder-node-name').filter({ hasText: 'HiddenSecret.md' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: await label('clearFolderFilter'), exact: true }).click();
    await page.locator('.folder-node-name').filter({ hasText: 'HiddenSecret.md' }).waitFor({ state: 'hidden' });
    await page.evaluate(() => { window.__folderSettingsNative.directories['C:\\notes'].push({ name: 'note3.md', dir: false, path: 'C:\\notes\\note3.md' }); });
    await page.getByRole('button', { name: await label('refreshFolder'), exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.folder-node-name').length >= 4);
    assert.deepEqual(await visibleNames(), ['zFolder', 'Note2.md', 'note3.md', 'note10.md']);
    record('Folder root errors retry safely, natural sorting works, cancel preserves the open folder and filtering explicitly covers loaded names only');

    await api('folder', null); await page.evaluate(() => { window.__folderSettingsNative.failDirectory = 'C:\\notes\\zFolder'; }); await api('folder', 'C:\\notes');
    await page.locator('.folder-node-name').filter({ hasText: 'zFolder' }).click();
    await page.locator('.folder-error').getByRole('button', { name: await label('retry'), exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.failDirectory = null; });
    await page.locator('.folder-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.locator('.folder-node-name').filter({ hasText: 'HiddenSecret.md' }).waitFor({ state: 'visible' });
    await page.evaluate(() => { window.__folderSettingsNative.openFailure = true; });
    await page.locator('.folder-node-name').filter({ hasText: 'Note2.md' }).click();
    await page.locator('.folder-error').getByRole('button', { name: await label('retry'), exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.openFailure = false; });
    await page.locator('.folder-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__folderSettingsNative.opened.length === 2);
    await api('folder', 'C:\\empty'); await page.getByText(await label('emptyMarkdownFolder'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.delayedDirectory = 'C:\\slow'; }); await api('folder', 'C:\\slow');
    await page.waitForFunction(() => Boolean(window.__folderSettingsNative.releaseDirectory)); await api('folder', 'C:\\other');
    await page.locator('.folder-node-name').filter({ hasText: 'CurrentResult.md' }).waitFor();
    await page.evaluate(() => window.__folderSettingsNative.releaseDirectory());
    assert.deepEqual(await visibleNames(), ['CurrentResult.md']);
    record('Lazy child reads and file-open failures retain recovery controls; empty folders and stale directory responses have distinct safe states');

    await api('mode', 'settings');
    await page.getByText(await label('imagePreferencesLoadFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.configFailure = false; });
    await page.locator('.image-preferences-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().image.loaded);
    const typeControl = () => page.getByRole('combobox', { name: '' });
    const imageType = page.locator('#image-save-type');
    const imagePath = page.locator('#image-save-path');
    assert.match(await page.locator('#image-save-path-hint').textContent(), /\$\{filename\}/);
    await imageType.click();
    const triggerBox = await imageType.locator('xpath=ancestor::*[contains(@class,"el-input")][1]').boundingBox();
    const popupBox = await page.locator('.el-select-dropdown:visible').first().boundingBox();
    assert.ok(Math.abs(triggerBox.width - popupBox.width) <= 2, 'Select popup should match its trigger geometry');
    await page.getByRole('option', { name: await label('sepc'), exact: true }).click();
    await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).click();
    assert.equal((await api('snapshot')).image.invalid, 'imagePathRequired');
    assert.equal(await imagePath.getAttribute('aria-invalid'), 'true');
    assert.equal(await imagePath.evaluate(element => document.activeElement === element), true);
    await imagePath.fill('relative/assets'); await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).click();
    assert.equal((await api('snapshot')).image.invalid, 'imagePathAbsolute');
    await page.getByRole('button', { name: await label('chooseImageFolder'), exact: true }).click();
    assert.equal(await imagePath.inputValue(), 'relative/assets', 'Picker cancellation preserves the draft');
    await page.evaluate(() => { window.__folderSettingsNative.picks.push('FAIL_PICKER'); });
    await page.getByRole('button', { name: await label('chooseImageFolder'), exact: true }).click();
    await page.getByText(await label('imageFolderPickerFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.picks.push('C:\\Assets'); });
    await page.locator('.image-preferences-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    assert.equal(await imagePath.inputValue(), 'C:\\Assets');
    await page.evaluate(() => { window.__folderSettingsNative.saveFailure = true; });
    await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).click();
    await page.getByText(await label('imagePreferencesSaveFailed'), { exact: true }).waitFor();
    assert.equal(await imagePath.inputValue(), 'C:\\Assets');
    await page.evaluate(() => { window.__folderSettingsNative.saveFailure = false; window.__folderSettingsNative.delaySave = true; });
    const beforeWidth = (await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).boundingBox()).width;
    await page.locator('.image-preferences-error').getByRole('button', { name: await label('retry'), exact: true }).click();
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().image.saving);
    assert.equal((await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).boundingBox()).width, beforeWidth);
    assert.equal(await imagePath.isDisabled(), true);
    await page.evaluate(() => window.__folderSettingsNative.releaseSave());
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().image.saved);
    assert.equal(await page.evaluate(() => window.__folderSettingsNative.config.image_save_type), 'sepc');
    record('Image settings validate sepc paths, label controls, preserve cancelled picks/drafts, expose failures and retry without moving the busy button');

    await imageType.click(); await page.getByRole('option', { name: 'PicGo', exact: true }).click();
    await imagePath.fill('file:///unsafe'); await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).click();
    assert.equal((await api('snapshot')).image.invalid, 'picgoPathInvalid');
    await imagePath.fill('C:\\PicGo\\PicGo.exe'); await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).click();
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().image.saved);
    await api('locale', 'zhCn'); await api('theme', 'dark'); await page.setViewportSize({ width: 390, height: 700 });
    await imageType.click(); await page.getByRole('option', { name: await label('sepc'), exact: true }).click();
    assert.equal(await imagePath.inputValue(), 'C:\\Assets', 'Mode switching retains each mode draft');
    await page.getByRole('button', { name: await label('saveImageSettings'), exact: true }).waitFor();
    assert.equal(await page.getByRole('switch', { name: await label('autoSave'), exact: true }).count(), 1);
    assert.equal(await page.getByRole('combobox', { name: await label('language'), exact: true }).count(), 1);
    await page.evaluate(() => { window.__folderSettingsNative.permissionFailure = true; });
    await page.getByRole('button', { name: await label('requestPermission'), exact: true }).click();
    await page.getByText(await label('notificationPermissionFailed'), { exact: true }).waitFor();
    await page.evaluate(() => { window.__folderSettingsNative.permissionFailure = false; });
    await page.getByRole('button', { name: await label('requestPermission'), exact: true }).click();
    await page.waitForFunction(() => window.__folderSettingsTest.snapshot().granted);
    await page.getByText(await label('granted'), { exact: true }).waitFor();
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    const screenshots = path.join(root, 'outputs'); fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({ path: path.join(screenshots, 'image-settings-chinese-dark.png') });
    record('PicGo accepts validated HTTP/CLI configuration; Chinese dark narrow settings keep mode drafts, accessible General controls and retryable permission requests');
    await api('mode', 'sidebar'); await api('folder', 'C:\\notes');
    await page.locator('.folder-node-name').filter({ hasText: 'Note2.md' }).waitFor();
    await page.screenshot({ path: path.join(screenshots, 'folder-sidebar-chinese-dark.png') });
    assert.deepEqual(errors, []); console.log('Folder/settings browser checks passed');
  } finally {
    await browser?.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
    const resolved = path.resolve(temporary);
    if (path.dirname(resolved) === root && path.basename(resolved).startsWith('.folder-settings-browser-test-')) fs.rmSync(resolved, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
