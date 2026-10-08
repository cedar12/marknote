const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createPinia, setActivePinia } = require('pinia');
const MarkdownIt = require('markdown-it');

function loadTypeScript(relativePath, dependencies = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
    module.exports,
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    module,
    file,
    path.dirname(file),
  );
  return module.exports;
}

const outline = loadTypeScript('src/utils/outline.ts');
const largeFile = loadTypeScript('src/utils/largeFile.ts');
const markdownPreferences = loadTypeScript('src/utils/markdownPreferences.ts');
const markdown = new MarkdownIt({ html: true });

// This adapter reads controlled test fragments. Production uses the browser DOMParser.
function readHeadingFragments(html) {
  const fragments = html.replace(/<(pre|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  return [...fragments.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map(match => ({
    level: Number(match[1]),
    text: markdown.utils.unescapeAll(match[2].replace(/<[^>]*>/g, '')),
  }));
}

function collect(content, segmentIndex) {
  return outline.collectMarkdownHeadings(content, segmentIndex, markdown, readHeadingFragments);
}

const headings = collect([
  '# **Root** `code` [link](https://example.com) &amp; 中文',
  '',
  'Setext title',
  '------------',
  '',
  '> ### Quoted title',
  '',
  '- #### List title',
  '',
  '```md',
  '# Fake fenced title',
  '```',
  '',
  '    ## Fake indented title',
  '',
  '<h2>HTML <em>title</em></h2>',
  '',
  '## Duplicate',
  '',
  '## Duplicate',
].join('\n'), 2);
assert.deepEqual(headings.map(heading => [heading.level, heading.text]), [
  [1, 'Root code link & 中文'],
  [2, 'Setext title'],
  [3, 'Quoted title'],
  [4, 'List title'],
  [2, 'HTML title'],
  [2, 'Duplicate'],
  [2, 'Duplicate'],
]);
assert.equal(new Set(headings.map(heading => heading.id)).size, headings.length, 'duplicate titles need distinct navigation IDs');
assert.ok(headings.every((heading, index) => heading.segmentIndex === 2 && heading.headingIndex === index));

const segmentHeadings = [collect('# Parent\n\n### Nested\n', 0), collect('#### Remote child\n\n# Next root\n', 1)];
let merged = outline.mergeOutlineHeadings(segmentHeadings, []);
merged[0].status = 'close';
merged[1].status = 'close';
merged = outline.mergeOutlineHeadings(segmentHeadings, merged);
assert.deepEqual(merged.map(heading => heading.show), [true, false, false, true], 'collapsed ancestors span segment boundaries and skipped levels');
merged[0].status = 'open';
merged = outline.mergeOutlineHeadings(segmentHeadings, merged);
assert.deepEqual(merged.map(heading => heading.show), [true, true, false, true], 'reopening a parent retains a nested collapse');

global.localStorage = { getItem: () => null };
const loggedErrors = [];
const { useEditorStore } = loadTypeScript('src/store/editor.ts', {
  '@tiptap/pm/state': {},
  '@tiptap/pm/model': {},
  '@tauri-apps/plugin-log': { error: message => loggedErrors.push(message) },
  '@tauri-apps/api/core': { isTauri: () => false },
  '../api/utils': {},
  '../utils/largeFile': largeFile,
  '../utils/outline': outline,
  './preferences': { usePreferencesStore: () => ({ markdown: markdownPreferences.DEFAULT_MARKDOWN_PREFERENCES }) },
  '../utils/markdownPreferences': markdownPreferences,
});

function createEditorMock(initialHeadings, savedMarkdown) {
  let currentNodes;
  const calls = { dispatched: 0, selection: null, focus: 0, scroll: 0, metadata: [] };
  const editor = {
    state: {},
    storage: { markdown: { options: {}, parser: { md: markdown }, getMarkdown: () => savedMarkdown.value } },
    commands: { focus: () => { calls.focus += 1; } },
    view: {
      dom: { closest: () => null },
      nodeDOM: () => null,
      dispatch(transaction) {
        calls.dispatched += 1;
        calls.metadata.push(transaction.metadata);
        for (const patch of transaction.patches) currentNodes.find(node => node.pos === patch.pos).attrs = patch.attrs;
      },
    },
    chain() {
      const chain = {
        focus() { calls.focus += 1; return chain; },
        setTextSelection(position) { calls.selection = position; return chain; },
        scrollIntoView() { calls.scroll += 1; return chain; },
        run() { return true; },
      };
      return chain;
    },
    setDoc(items) {
      currentNodes = items.map((heading, index) => ({
        type: { name: 'heading' },
        attrs: { level: heading.level, id: heading.id || null },
        textContent: heading.text,
        pos: index * 20,
      }));
      editor.state.doc = { descendants: callback => currentNodes.forEach(node => callback(node, node.pos)) };
    },
    nodes: () => currentNodes,
    calls,
  };
  Object.defineProperty(editor.state, 'tr', {
    get() {
      const transaction = {
        docChanged: false,
        patches: [],
        metadata: {},
        setNodeMarkup(pos, _type, attrs) { this.patches.push({ pos, attrs }); this.docChanged = true; return this; },
        setMeta(key, value) { this.metadata[key] = value; return this; },
      };
      return transaction;
    },
  });
  editor.setDoc(initialHeadings);
  return editor;
}

async function testStore() {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const savedMarkdown = { value: '# Edited parent\n\n' };
  const editor = createEditorMock([{ level: 1, text: 'Edited parent' }], savedMarkdown);
  store.setEditor(editor);
  store.segmented = true;
  store.segments = ['# Original parent\n\n', '## Remote\n\n### Target\n\n'];
  store.segmentDirty = true;
  let parsedSegments = 0;
  store.readMarkdownHeadings = (content, segmentIndex) => { parsedSegments += 1; return collect(content, segmentIndex); };
  store.updateHeadings();
  assert.deepEqual(store.headings.map(heading => heading.text), ['Edited parent', 'Remote', 'Target'], 'outline includes unloaded segments and current unsaved headings');
  assert.equal(parsedSegments, 1, 'the current document uses PM headings instead of parsing stale markdown');
  store.headings[0].status = 'close';
  store.updateHeadings();
  assert.equal(parsedSegments, 1, 'unchanged unloaded segments reuse their index');
  assert.equal(editor.calls.dispatched, 1, 'heading refresh does not dispatch empty transactions');
  assert.deepEqual(editor.calls.metadata[0], { addToHistory: false, preventUpdate: true });
  assert.equal(store.headings[0].status, 'close', 'ordinary edits preserve collapse state');
  assert.equal(store.headings[2].show, false, 'collapsed parent hides headings in later segments');

  editor.setDoc([{ level: 1, text: 'Inserted' }, { level: 1, text: 'Renamed parent', id: 'heading-0-0' }]);
  savedMarkdown.value = '# Inserted\n\n# Renamed parent\n\n';
  store.updateHeadings();
  assert.equal(store.headings[0].status, 'open', 'a new heading must not inherit another heading collapse');
  assert.equal(store.headings[1].status, 'close', 'an existing heading retains its collapse after insertion and renaming');

  store.renderEditorBody = async content => ({ content });
  store.replaceEditorDocument = body => editor.setDoc(collect(body.content, store.segmentIndex));
  const target = store.headings.find(heading => heading.text === 'Target');
  assert.equal(await store.navigateToHeading(target), true);
  assert.equal(store.segmentIndex, 1, 'navigation loads the target segment');
  assert.equal(editor.calls.selection, 21, 'navigation selects the target heading ordinal rather than the first duplicate ID');
  assert.equal(editor.calls.scroll, 1);
  assert.equal(editor.calls.focus, 1, 'cross-segment heading navigation owns focus instead of queuing a competing segment-start focus');
  assert.equal(store.segments[0], savedMarkdown.value, 'navigation commits unsaved Markdown before leaving its segment');
  assert.equal(store.headings.find(heading => heading.text === 'Renamed parent').status, 'close');
  assert.equal(store.navigatingToHeading, false);
  assert.equal(await store.navigateToHeading({ ...target, headingIndex: 99 }), false, 'missing headings fail without throwing');

  global.HTMLElement = class HTMLElement {};
  const segmentNavigation = { getBoundingClientRect: () => ({ bottom: 54 }) };
  const scrollContainer = {
    scrollTop: 100,
    querySelector: selector => selector === '.segment-navigation' ? segmentNavigation : null,
  };
  const headingElement = new global.HTMLElement();
  headingElement.getBoundingClientRect = () => ({ top: 25 });
  editor.view.dom.closest = selector => selector === '.el-scrollbar__wrap' ? scrollContainer : null;
  editor.view.nodeDOM = pos => pos === 20 ? headingElement : null;
  assert.equal(await store.navigateToHeading(target), true);
  assert.equal(scrollContainer.scrollTop, 63, 'same-segment headings scroll below the measured sticky navigation with an 8px gap');

  scrollContainer.scrollTop = 100;
  segmentNavigation.getBoundingClientRect = () => ({ bottom: 70 });
  headingElement.getBoundingClientRect = () => ({ top: 100 });
  assert.equal(await store.navigateToHeading(target), true);
  assert.equal(scrollContainer.scrollTop, 100, 'visible headings do not cause an additional scroll');

  scrollContainer.scrollTop = 4;
  headingElement.getBoundingClientRect = () => ({ top: 5 });
  const firstRemoteHeading = store.headings.find(heading => heading.text === 'Remote');
  editor.view.nodeDOM = () => headingElement;
  assert.equal(await store.navigateToHeading(firstRemoteHeading), true);
  assert.equal(scrollContainer.scrollTop, 0, 'a heading at the document start clamps naturally to the top');

  editor.view.dom.closest = () => null;

  const beforeFailure = store.segmentIndex;
  store.segmentDirty = true;
  store.renderEditorBody = async () => { throw new Error('fixture render failure'); };
  const parent = store.headings.find(heading => heading.text === 'Renamed parent');
  assert.equal(await store.navigateToHeading(parent), false);
  assert.equal(store.segmentIndex, beforeFailure, 'render failures retain the current segment');
  assert.equal(store.segmentDirty, true, 'render failures retain pending edits');
  assert.equal(store.navigatingToHeading, false, 'failed navigation releases its lock');

  let releaseRender;
  store.renderEditorBody = content => new Promise(resolve => { releaseRender = () => resolve({ content }); });
  scrollContainer.scrollTop = 100;
  editor.view.dom.closest = () => scrollContainer;
  const navigation = store.navigateToHeading(parent);
  assert.equal(store.navigatingToHeading, true);
  assert.equal(await store.navigateToHeading(parent), false, 'overlapping heading clicks cannot start competing loads');
  releaseRender();
  assert.equal(await navigation, true);
  assert.equal(scrollContainer.scrollTop, 27, 'cross-segment headings receive the same measured sticky-header correction');
  assert.equal(store.navigatingToHeading, false);

  store.renderEditorBody = async content => { store.renderVersion += 1; return { content }; };
  assert.equal(await store.navigateToHeading(target), false, 'a newer document load cancels stale heading navigation');
  assert.equal(store.segmentIndex, 0);
  assert.ok(loggedErrors.length > 0, 'navigation/render failures reach the existing log');
}

async function testParsingPreferenceReindex() {
  setActivePinia(createPinia());
  const store = useEditorStore();
  const saved = { value: '# Current parent\n\n## Current child\n\nUnsaved content\n\n' };
  const editor = createEditorMock([{ level: 1, text: 'Current parent' }, { level: 2, text: 'Current child' }], saved);
  store.setEditor(editor);
  store.segmented = true;
  store.segments = [
    '# Stale current content\n\n',
    '<h2>Removed HTML</h2>\n\n# Markdown target\n\n## Retained collapse\n\n',
    '<h2>Duplicate title</h2>\n\n## Duplicate title\n\n',
    '# "Quoted" heading\n\n',
  ];
  store.segmentDirty = true;
  store.readMarkdownHeadings = collect;
  store.updateHeadings();
  store.headings.find(heading => heading.text === 'Current child').status = 'close';
  store.headings.find(heading => heading.text === 'Removed HTML').status = 'close';
  store.headings.find(heading => heading.text === 'Retained collapse').status = 'close';
  store.headings.find(heading => heading.text === 'Duplicate title').status = 'close';
  const currentDocument = editor.state.doc;
  const selection = editor.state.selection = { from: 7, to: 7 };
  const history = editor.state.history = { undoDepth: 4 };
  const dispatched = editor.calls.dispatched;
  assert.equal(store.headings.find(heading => heading.text === 'Markdown target').headingIndex, 1);

  markdown.set({ html: false });
  store.reindexOtherSegments();
  assert.equal(store.headings.some(heading => heading.text === 'Removed HTML'), false);
  const target = store.headings.find(heading => heading.text === 'Markdown target');
  assert.equal(target.headingIndex, 0, 'HTML removal refreshes cached ordinals before navigation');
  assert.equal(target.status, 'open', 'removed HTML collapse cannot transfer through its former ordinal');
  assert.equal(store.headings.find(heading => heading.text === 'Retained collapse').status, 'close', 'unique remote content identity preserves collapse after ordinal changes');
  assert.equal(store.headings.find(heading => heading.text === 'Duplicate title').status, 'open', 'ambiguous duplicate identities cannot inherit the removed HTML collapse');
  assert.equal(store.headings.find(heading => heading.text === 'Current child').status, 'close');
  assert.equal(store.headings[0].text, 'Current parent', 'current headings retain unsaved PM content');
  assert.equal(editor.state.doc, currentDocument);
  assert.equal(editor.state.selection, selection);
  assert.equal(editor.state.history, history);
  assert.equal(editor.calls.dispatched, dispatched, 'reindexing other segments never dispatches into the current document');
  assert.equal(store.segmentDirty, true);
  assert.equal(store.segments[0], '# Stale current content\n\n');

  markdown.set({ typographer: true });
  store.reindexOtherSegments();
  assert.equal(store.headings.some(heading => heading.text === '“Quoted” heading'), true, 'typographer changes refresh cached heading text');
  let release;
  store.renderEditorBody = content => new Promise(resolve => { release = () => resolve({ content }); });
  const staleNavigation = store.navigateToHeading(store.headings.find(heading => heading.text === 'Markdown target'));
  markdown.set({ breaks: false });
  store.reindexOtherSegments();
  release();
  assert.equal(await staleNavigation, false, 'a segment load begun under old parsing preferences is cancelled');
  assert.equal(store.segmentIndex, 0);
  assert.equal(editor.state.doc, currentDocument);
  assert.equal(store.segmentDirty, true);
  store.renderEditorBody = async content => ({ content });
  store.replaceEditorDocument = body => editor.setDoc(collect(body.content, store.segmentIndex));
  assert.equal(await store.navigateToHeading(store.headings.find(heading => heading.text === 'Markdown target')), true);
  assert.equal(store.segmentIndex, 1);
  assert.equal(editor.calls.selection, 1, 'navigation uses the refreshed target ordinal');
  assert.equal(store.segments[0], saved.value, 'navigation still commits the original current pending edits');
  markdown.set({ html: true, typographer: false });
}

testStore().then(testParsingPreferenceReindex).then(() => {
  console.log('outline: markdown headings, full-document cache, collapse state, unsaved segment navigation, parsing-preference reindexing and failures verified');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
