const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const MarkdownIt = require('markdown-it');
const { createPinia, setActivePinia } = require('pinia');

const root = path.resolve(__dirname, '..');
function loadModule(relativePath, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
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

const preferences = loadModule('src/utils/markdownPreferences.ts');
const editorFont = loadModule('src/utils/editorFont.ts');
const shortcuts = loadModule('src/utils/shortcutPreferences.ts');
const { DEFAULT_MARKDOWN_PREFERENCES: defaults, normalizeMarkdownPreferences, applyMarkdownPreferencesToEditor } = preferences;

function fixture() {
  setActivePinia(createPinia());
  const calls = { reads: 0, writes: [], emits: [], reindexes: 0 };
  const document = { unchanged: true };
  const selection = { from: 12, to: 12 };
  const history = { undoDepth: 3 };
  const storedValues = new Map();
  const storage = { failure: false, getItem: key => storedValues.get(key) ?? null,
    setItem(key, value) { if (this.failure) throw new Error('Local storage unavailable'); storedValues.set(key, value); } };
  const editorMode = loadModule('src/utils/editorModePreferences.ts', {}, { localStorage: storage });
  const editor = { state: { doc: document, selection, history }, storage: { markdown: { options: {}, parser: { md: new MarkdownIt() } } } };
  const api = {
    getConfig: async () => ({ code: 0, data: {} }),
    saveMarkdownPreferences: async () => ({ code: 0, info: '' }),
    emit: async () => {},
  };
  const { usePreferencesStore } = loadModule('src/store/preferences.ts', {
    '../utils/markdownPreferences': preferences,
    '../utils/editorFont': editorFont,
    '../utils/editorModePreferences': editorMode,
    '../utils/shortcutPreferences': shortcuts,
    './editor': { useEditorStore: () => ({ editor, reindexOtherSegments() { calls.reindexes += 1; } }) },
    '@tauri-apps/api/core': { isTauri: () => true },
    '@tauri-apps/api/event': { emit: async (name, value) => { calls.emits.push({ name, value }); return api.emit(name, value); } },
    '../api/preferences': {
      getConfig: () => { calls.reads += 1; return api.getConfig(); },
      saveMarkdownPreferences: options => { calls.writes.push(options); return api.saveMarkdownPreferences(options); },
    },
  }, { localStorage: storage });
  return { store: usePreferencesStore(), calls, api, editor, document, selection, history, storage, editorMode };
}

function values(value) { return JSON.parse(JSON.stringify(value)); }
function defer() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function main() {
  for (const value of [undefined, null, '', 'Source', 'rendered', 'true', true, ' source ', '{"mode":"source"}']) {
    const mode = loadModule('src/utils/editorModePreferences.ts', {}, { localStorage: { getItem: () => value } });
    assert.equal(mode.isSourceMode(value), false);
    assert.equal(mode.readEditorMode(), 'wysiwyg', 'invalid persisted modes use the safe default');
  }
  for (const value of ['wysiwyg', 'source', 'split']) {
    const mode = loadModule('src/utils/editorModePreferences.ts', {}, { localStorage: { getItem: () => value } });
    assert.equal(mode.isSourceMode(value), true);
    assert.equal(mode.readEditorMode(), value);
  }
  const deniedMode = loadModule('src/utils/editorModePreferences.ts', {}, { localStorage: { getItem() { throw new Error('Denied'); } } });
  assert.equal(deniedMode.readEditorMode(), 'wysiwyg');
  const modes = fixture();
  await modes.store.saveEditorMode('source');
  assert.equal(modes.store.editorMode, 'source');
  assert.equal(modes.editorMode.readEditorMode(), 'source', 'store and real reader share the persisted preference');
  assert.equal(modes.store.editorModeRevision, 1);
  assert.equal(modes.calls.emits[0].name, modes.editorMode.EDITOR_MODE_PREFERENCES_EVENT);
  assert.equal(modes.calls.emits[0].value, 'source');
  modes.storage.failure = true;
  await assert.rejects(modes.store.saveEditorMode('split'), /Local storage unavailable/);
  assert.equal(modes.store.editorMode, 'source');
  assert.equal(modes.editorMode.readEditorMode(), 'source');
  assert.equal(modes.store.editorModeRevision, 1);
  assert.equal(modes.calls.emits.length, 1, 'failed persistence does not broadcast an unsaved mode');
  assert.match(modes.store.editorModeSaveError, /Local storage unavailable/);
  assert.equal(modes.store.savingEditorMode, false);
  modes.storage.failure = false;
  modes.api.emit = async () => { throw new Error('Event channel unavailable'); };
  await modes.store.saveEditorMode('split');
  assert.equal(modes.store.editorMode, 'split');
  assert.equal(modes.editorMode.readEditorMode(), 'split');
  assert.equal(modes.store.editorModeSaveError, null);
  assert.match(modes.store.editorModeSyncError, /Event channel unavailable/);
  assert.equal(modes.store.savingEditorMode, false);
  modes.api.emit = async () => {};
  await modes.store.saveEditorMode('split');
  assert.equal(modes.store.editorModeSyncError, null, 'retry sends the already-persisted mode');
  const modeRevision = modes.store.editorModeRevision;
  modes.store.applyEditorMode('split');
  assert.equal(modes.store.editorModeRevision, modeRevision, 'duplicate incoming storage/native mode events do not request another view switch');
  modes.store.applyEditorMode('invalid');
  assert.equal(modes.store.editorModeRevision, modeRevision);
  await assert.rejects(modes.store.saveEditorMode('invalid'), /Invalid editor mode/);
  assert.equal(modes.store.editorMode, 'split');
  assert.equal(modes.editor.state.doc, modes.document);
  assert.equal(modes.editor.state.selection, modes.selection);
  assert.equal(modes.editor.state.history, modes.history, 'saving a mode preference does not edit the current document');
  assert.deepEqual(values(normalizeMarkdownPreferences({ html: 'false', breaks: 0, bulletListMarker: 'invalid', other: true })), values(defaults));
  for (const marker of ['-', '*', '+']) assert.equal(normalizeMarkdownPreferences({ bulletListMarker: marker }).bulletListMarker, marker);

  const runtime = fixture();
  const source = 'A\nB\n\n<span>raw</span> https://example.com "quotes" (c) ...';
  applyMarkdownPreferencesToEditor(runtime.editor, defaults);
  const normal = runtime.editor.storage.markdown.parser.md.render(source);
  assert.match(normal, /A<br>/);
  assert.match(normal, /<span>raw<\/span>/);
  assert.doesNotMatch(normal, /href=/);
  applyMarkdownPreferencesToEditor(runtime.editor, { ...defaults, html: false, breaks: false, linkify: true, typographer: true });
  const configured = runtime.editor.storage.markdown.parser.md.render(source);
  assert.match(configured, /A\nB/);
  assert.match(configured, /&lt;span&gt;raw&lt;\/span&gt;/);
  assert.match(configured, /href="https:\/\/example.com"/);
  assert.match(configured, /“quotes” © …/);
  assert.equal(runtime.editor.state.doc, runtime.document);
  assert.equal(runtime.editor.state.selection, runtime.selection);
  assert.equal(runtime.editor.state.history, runtime.history);

  const indexing = fixture();
  indexing.store.applyMarkdownPreferences({ ...defaults, tightLists: false, bulletListMarker: '*', transformPastedText: true, transformCopiedText: true });
  assert.equal(indexing.calls.reindexes, 0, 'output and clipboard preferences retain the outline cache');
  for (const key of ['html', 'breaks', 'linkify', 'typographer']) {
    indexing.store.applyMarkdownPreferences({ ...indexing.store.markdown, [key]: !indexing.store.markdown[key] });
  }
  assert.equal(indexing.calls.reindexes, 4, 'every parsing preference refreshes other segments');
  indexing.store.applyMarkdownPreferences(indexing.store.markdown);
  assert.equal(indexing.calls.reindexes, 4, 'duplicate preference events retain the refreshed cache');

  const saved = fixture();
  const stored = { ...defaults, breaks: false, linkify: true, typographer: true, tightLists: false, bulletListMarker: '+', transformPastedText: true, transformCopiedText: true };
  saved.api.getConfig = async () => ({ code: 0, data: { markdown_preferences: JSON.stringify(stored) } });
  await saved.store.loadMarkdownPreferences();
  assert.deepEqual(values(saved.store.markdown), values(stored));
  assert.equal(saved.editor.storage.markdown.parser.md.options.breaks, false);
  const write = defer();
  saved.api.saveMarkdownPreferences = () => write.promise;
  const saving = saved.store.saveMarkdownPreferences({ bulletListMarker: '*', html: false });
  assert.equal(saved.store.savingMarkdown, true);
  assert.equal(saved.store.markdown.bulletListMarker, '+');
  assert.equal(saved.calls.emits.length, 0);
  write.resolve({ code: 0, info: '' });
  await saving;
  assert.equal(saved.store.savingMarkdown, false);
  assert.equal(saved.store.markdown.bulletListMarker, '*');
  assert.equal(saved.store.markdown.html, false);
  assert.equal(saved.calls.emits[0].name, 'markdownPreferences');
  assert.equal(saved.calls.writes[0].transformCopiedText, true);
  saved.api.saveMarkdownPreferences = async () => ({ code: 1, info: 'Disk full' });
  await assert.rejects(saved.store.saveMarkdownPreferences({ bulletListMarker: '-' }), /Disk full/);
  assert.equal(saved.store.markdown.bulletListMarker, '*');
  assert.equal(saved.calls.emits.length, 1);

  const syncFailure = fixture();
  await syncFailure.store.loadMarkdownPreferences();
  syncFailure.api.emit = async () => { throw new Error('Event channel unavailable'); };
  await syncFailure.store.saveMarkdownPreferences({ bulletListMarker: '+' });
  assert.equal(syncFailure.store.markdown.bulletListMarker, '+');
  assert.equal(syncFailure.editor.storage.markdown.options.bulletListMarker, '+');
  assert.equal(syncFailure.calls.writes[0].bulletListMarker, '+');
  assert.match(syncFailure.store.markdownSyncError, /Event channel unavailable/);
  assert.equal(syncFailure.store.savingMarkdown, false);
  syncFailure.api.emit = async () => {};
  await syncFailure.store.saveMarkdownPreferences({ bulletListMarker: '*' });
  assert.equal(syncFailure.store.markdownSyncError, null);
  assert.equal(syncFailure.store.markdown.bulletListMarker, '*');

  const failedRead = fixture();
  failedRead.api.getConfig = async () => ({ code: 1, info: 'Read failed' });
  await assert.rejects(failedRead.store.loadMarkdownPreferences(), /Read failed/);
  await assert.rejects(failedRead.store.saveMarkdownPreferences({ breaks: false }), /Read failed/);
  assert.equal(failedRead.calls.writes.length, 0);
  assert.equal(failedRead.store.markdownLoaded, false);
  failedRead.api.getConfig = async () => ({ code: 0, data: {} });
  await failedRead.store.loadMarkdownPreferences();
  assert.equal(failedRead.store.markdownLoaded, true);
  assert.equal(failedRead.store.markdownLoadError, null);

  const concurrent = fixture();
  const read = defer();
  concurrent.api.getConfig = () => read.promise;
  const first = concurrent.store.loadMarkdownPreferences();
  const second = concurrent.store.loadMarkdownPreferences();
  assert.equal(concurrent.calls.reads, 1);
  concurrent.store.applyMarkdownPreferences({ ...defaults, bulletListMarker: '*' });
  read.resolve({ code: 0, data: { markdown_preferences: JSON.stringify(stored) } });
  await Promise.all([first, second]);
  assert.equal(concurrent.store.markdown.bulletListMarker, '*');

  console.log('Markdown preferences checks passed: normalization, parser options, document/history preservation, database persistence, rollback, synchronization errors, retry and concurrent reads.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
