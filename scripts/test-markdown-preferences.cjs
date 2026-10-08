const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const MarkdownIt = require('markdown-it');
const { createPinia, setActivePinia } = require('pinia');

const root = path.resolve(__dirname, '..');
function loadModule(relativePath, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require(name) { return name in imports ? imports[name] : require(name); },
    localStorage: { getItem() { return null; }, setItem() {} },
  }, { filename: relativePath });
  return module.exports;
}

const preferences = loadModule('src/utils/markdownPreferences.ts');
const { DEFAULT_MARKDOWN_PREFERENCES: defaults, normalizeMarkdownPreferences, applyMarkdownPreferencesToEditor } = preferences;

function fixture() {
  setActivePinia(createPinia());
  const calls = { reads: 0, writes: [], emits: [], reindexes: 0 };
  const document = { unchanged: true };
  const selection = { from: 12, to: 12 };
  const history = { undoDepth: 3 };
  const editor = { state: { doc: document, selection, history }, storage: { markdown: { options: {}, parser: { md: new MarkdownIt() } } } };
  const api = {
    getConfig: async () => ({ code: 0, data: {} }),
    saveMarkdownPreferences: async () => ({ code: 0, info: '' }),
    emit: async () => {},
  };
  const { usePreferencesStore } = loadModule('src/store/preferences.ts', {
    '../utils/markdownPreferences': preferences,
    './editor': { useEditorStore: () => ({ editor, reindexOtherSegments() { calls.reindexes += 1; } }) },
    '@tauri-apps/api/core': { isTauri: () => true },
    '@tauri-apps/api/event': { emit: async (name, value) => { calls.emits.push({ name, value }); return api.emit(name, value); } },
    '../api/preferences': {
      getConfig: () => { calls.reads += 1; return api.getConfig(); },
      saveMarkdownPreferences: options => { calls.writes.push(options); return api.saveMarkdownPreferences(options); },
    },
  });
  return { store: usePreferencesStore(), calls, api, editor, document, selection, history };
}

function values(value) { return JSON.parse(JSON.stringify(value)); }
function defer() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function main() {
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
