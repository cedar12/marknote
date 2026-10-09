const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createPinia, setActivePinia } = require('pinia');

const root = path.resolve(__dirname, '..');
function loadModule(relativePath, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name) { return name in imports ? imports[name] : require(name); },
    localStorage: { getItem() { return null; }, setItem() {} },
    ...globals,
  }, { filename: relativePath });
  return module.exports;
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const shortcuts = loadModule('src/utils/shortcutPreferences.ts');
const markdown = loadModule('src/utils/markdownPreferences.ts');
const editorFont = loadModule('src/utils/editorFont.ts');
const { SHORTCUT_DEFINITIONS, DEFAULT_SHORTCUT_PREFERENCES: defaults, normalizeShortcut, normalizeShortcutPreferences,
  validateShortcutPreferences, shortcutFromKeyboardEvent, shortcutMatchesEvent } = shortcuts;
const event = patch => ({ key: 'b', code: 'KeyB', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, ...patch });

function fixture({ tauri = true, cached = null } = {}) {
  setActivePinia(createPinia());
  const calls = { reads: 0, writes: [], emits: [], cached: [] };
  const api = {
    getConfig: async () => ({ code: 0, data: {} }),
    save: async () => ({ code: 0, info: '' }),
    emit: async () => {},
  };
  const storage = { getItem: key => key === shortcuts.SHORTCUT_PREFERENCES_KEY ? cached : null,
    setItem(key, value) { calls.cached.push({ key, value }); } };
  const fixtureShortcuts = loadModule('src/utils/shortcutPreferences.ts', {}, { localStorage: storage });
  const { usePreferencesStore } = loadModule('src/store/preferences.ts', {
    '../utils/shortcutPreferences': fixtureShortcuts,
    '../utils/markdownPreferences': markdown,
    '../utils/editorFont': editorFont,
    './editor': { useEditorStore: () => ({ editor: undefined, reindexOtherSegments() {} }) },
    '@tauri-apps/api/core': { isTauri: () => tauri },
    '@tauri-apps/api/event': { emit: async (name, value) => { calls.emits.push({ name, value: plain(value) }); await api.emit(name, value); } },
    '../api/preferences': {
      getConfig: () => { calls.reads += 1; return api.getConfig(); },
      saveShortcutPreferences: options => { calls.writes.push(plain(options)); return api.save(options); },
      saveMarkdownPreferences: async () => ({ code: 0, info: '' }),
    },
  }, { localStorage: storage });
  return { store: usePreferencesStore(), calls, api };
}

async function main() {
  assert.equal(SHORTCUT_DEFINITIONS.length, new Set(SHORTCUT_DEFINITIONS.map(item => item.id)).size);
  assert.deepEqual(plain(validateShortcutPreferences(defaults, 'windows')), {});
  assert.deepEqual(plain(validateShortcutPreferences(defaults, 'macos')), {});
  assert.equal(normalizeShortcut(' control + shift + k ', 'windows'), 'Mod+Shift+K');
  assert.equal(normalizeShortcut('Command+Option+K', 'macos'), 'Mod+Alt+K');
  assert.equal(normalizeShortcut('Ctrl+K', 'macos'), 'Ctrl+K', 'Mac Control is distinct from Command');
  assert.equal(normalizeShortcut('Win+K', 'windows'), 'Meta+K');
  assert.equal(normalizeShortcut('Mod+Meta+K', 'macos'), null, 'aliases cannot repeat the Mac primary modifier');
  assert.equal(normalizeShortcut('Ctrl+Meta+K', 'macos'), 'Mod+Ctrl+K');
  assert.equal(normalizeShortcut('Ctrl+Meta+K', 'windows'), 'Mod+Meta+K');
  assert.equal(normalizeShortcut('Mod++', 'windows'), 'Mod+Shift+=');
  assert.equal(normalizeShortcut('F10'), 'F10');
  assert.equal(normalizeShortcut(''), '');
  for (const invalid of [null, 12, 'K', 'Shift+B', 'Mod', 'Mod+Ctrl+B', 'Mod+B+C', 'Mod+F13', 'Mod+NotAKey']) {
    assert.equal(normalizeShortcut(invalid, 'windows'), null, `reject invalid binding ${JSON.stringify(invalid)}`);
  }
  const conflict = validateShortcutPreferences({ ...defaults, 'format.italic': 'Control+B' }, 'windows');
  assert.equal(conflict['format.bold'].type, 'conflict');
  assert.equal(conflict['format.italic'].conflictWith, 'format.bold');
  assert.equal(validateShortcutPreferences({ ...defaults, 'format.bold': 'Mod+Ctrl+K', 'format.italic': 'Control+Command+K' }, 'macos')['format.bold'].type, 'conflict');
  assert.deepEqual(plain(validateShortcutPreferences({ ...defaults, 'format.bold': '', 'format.italic': '' })), {});
  assert.deepEqual(plain(validateShortcutPreferences({ ...defaults, 'format.bold': 'Mod+I', 'format.italic': 'Mod+B' })), {}, 'a full candidate can swap two bindings');
  assert.deepEqual(plain(normalizeShortcutPreferences({ 'format.bold': null, unknown: 'Mod+K' })), plain(defaults));
  assert.deepEqual(plain(normalizeShortcutPreferences({ ...defaults, 'format.bold': 'Mod+I' })), plain(defaults), 'ambiguous saved maps fall back safely');
  assert.equal(normalizeShortcutPreferences({ ...defaults, 'format.bold': '' })['format.bold'], '', 'disabled binding remains disabled');

  assert.equal(shortcutFromKeyboardEvent(event({ key: 'K', code: 'KeyK', shiftKey: true })), 'Mod+Shift+K');
  assert.equal(shortcutFromKeyboardEvent(event({ key: '*', code: 'Digit8', shiftKey: true })), 'Mod+Shift+8', 'shifted number row is matched using physical key');
  assert.equal(shortcutFromKeyboardEvent(event({ key: '>', code: 'Period', shiftKey: true })), 'Mod+Shift+.');
  assert.equal(shortcutMatchesEvent('Mod+Plus', event({ key: '+', code: 'Equal', shiftKey: true })), true);
  assert.equal(shortcutFromKeyboardEvent(event({ ctrlKey: false, metaKey: true }), 'macos'), 'Mod+B');
  assert.equal(shortcutMatchesEvent('Mod+B', event()), true);
  assert.equal(shortcutMatchesEvent('Mod+B', event({ shiftKey: true })), false);
  assert.equal(shortcutMatchesEvent('', event()), false);
  for (const patch of [{ isComposing: true }, { key: 'Process' }, { key: 'Dead' }, { key: 'Unidentified' }]) {
    assert.equal(shortcutFromKeyboardEvent(event(patch)), null);
    assert.equal(shortcutMatchesEvent('Mod+B', event(patch)), false);
  }
  const damagedCache = loadModule('src/utils/shortcutPreferences.ts', {}, { localStorage: { getItem: () => '{bad' } });
  assert.deepEqual(plain(damagedCache.readShortcutPreferences()), plain(defaults));

  const saved = fixture();
  const persisted = { ...defaults, 'format.bold': 'Mod+Shift+K', 'format.italic': '' };
  saved.api.getConfig = async () => ({ code: 0, data: { shortcut_preferences: JSON.stringify(persisted) } });
  await saved.store.loadShortcutPreferences();
  assert.deepEqual(plain(saved.store.shortcuts), persisted);
  const write = deferred();
  saved.api.save = () => write.promise;
  const saving = saved.store.saveShortcutPreferences({ 'format.bold': 'Control+Alt+K' });
  assert.equal(saved.store.savingShortcuts, true);
  assert.equal(saved.store.shortcuts['format.bold'], 'Mod+Shift+K', 'pending save retains active shortcuts');
  await assert.rejects(saved.store.saveShortcutPreferences({ 'format.bold': '' }), /being saved/);
  write.resolve({ code: 0, info: '' });
  await saving;
  assert.equal(saved.store.shortcuts['format.bold'], 'Mod+Alt+K');
  assert.equal(saved.calls.writes[0]['format.italic'], '', 'save preserves unrelated preferences');
  assert.equal(saved.calls.emits[0].name, 'shortcutPreferences');
  assert.equal(saved.calls.cached[0].key, 'shortcut_preferences');
  saved.api.save = async () => ({ code: 1, info: 'Disk full' });
  await assert.rejects(saved.store.saveShortcutPreferences({ 'format.bold': '' }), /Disk full/);
  assert.equal(saved.store.shortcuts['format.bold'], 'Mod+Alt+K');
  assert.match(saved.store.shortcutSaveError, /Disk full/);
  assert.equal(saved.calls.emits.length, 1, 'failed writes never broadcast');
  const writesBeforeConflict = saved.calls.writes.length;
  await assert.rejects(saved.store.saveShortcutPreferences({ 'format.bold': 'Mod+S' }), /conflicting/);
  assert.equal(saved.calls.writes.length, writesBeforeConflict, 'conflicting choices never reach storage');

  const sync = fixture();
  await sync.store.loadShortcutPreferences();
  sync.api.emit = async () => { throw new Error('Event channel unavailable'); };
  await sync.store.saveShortcutPreferences({ 'format.bold': 'Mod+Shift+K' });
  assert.equal(sync.store.shortcuts['format.bold'], 'Mod+Shift+K');
  assert.match(sync.store.shortcutSyncError, /Event channel unavailable/);
  sync.api.emit = async () => {};
  await sync.store.saveShortcutPreferences({ 'format.bold': '' });
  assert.equal(sync.store.shortcutSyncError, null);

  const failedRead = fixture();
  failedRead.api.getConfig = async () => ({ code: 1, info: 'Read failed' });
  await assert.rejects(failedRead.store.loadShortcutPreferences(), /Read failed/);
  await assert.rejects(failedRead.store.saveShortcutPreferences({ 'format.bold': '' }), /Read failed/);
  assert.equal(failedRead.calls.writes.length, 0);
  assert.equal(failedRead.store.shortcutsLoaded, false);
  failedRead.api.getConfig = async () => ({ code: 0, data: {} });
  await failedRead.store.loadShortcutPreferences();
  assert.equal(failedRead.store.shortcutLoadError, null);
  assert.equal(failedRead.store.shortcutsLoaded, true);

  const concurrent = fixture();
  const read = deferred();
  concurrent.api.getConfig = () => read.promise;
  const first = concurrent.store.loadShortcutPreferences();
  const second = concurrent.store.loadShortcutPreferences();
  assert.equal(concurrent.calls.reads, 1);
  concurrent.store.applyShortcutPreferences(persisted);
  read.resolve({ code: 0, data: { shortcut_preferences: JSON.stringify(defaults) } });
  await Promise.all([first, second]);
  assert.deepEqual(plain(concurrent.store.shortcuts), persisted, 'an in-flight database read cannot overwrite a newer event');

  const preview = fixture({ tauri: false, cached: JSON.stringify(persisted) });
  await preview.store.saveShortcutPreferences({ 'format.bold': 'Mod+B' });
  assert.equal(preview.calls.reads, 0);
  assert.equal(preview.calls.writes.length, 0);
  assert.equal(preview.store.shortcuts['format.bold'], 'Mod+B');
  assert.equal(JSON.parse(preview.calls.cached[0].value)['format.italic'], '');
  console.log('Shortcut preference checks passed: normalization, platform keys, conflict validation, recording/IME, persistence, rollback, sync failures, retry, concurrent reads and browser storage.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
