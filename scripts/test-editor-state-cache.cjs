const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Schema } = require('@tiptap/pm/model');
const { EditorState } = require('@tiptap/pm/state');
const { history, undo, redo } = require('@tiptap/pm/history');
const { CharacterCount } = require('@tiptap/extension-character-count');
function load(relativePath) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(module.exports, require, module);
  return module.exports;
}
const { SegmentEditorCache } = load('src/utils/segmentCache.ts');
const { EditorStatisticsCache } = load('src/utils/editorStatistics.ts');
const { changedDocumentRanges, changedBlockNodes } = load('src/utils/editorTransactions.ts');
const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { group: 'block', content: 'inline*' },
  heading: { group: 'block', content: 'inline*', attrs: { id: { default: null }, level: { default: 1 } } },
  codeBlock: { group: 'block', content: 'text*', code: true, attrs: { language: { default: null } } },
  blockquote: { group: 'block', content: 'block+' }, horizontalRule: { group: 'block' },
  image: { inline: true, group: 'inline', atom: true }, text: { group: 'inline' },
}, marks: { strong: {} } });
const paragraph = text => schema.node('paragraph', null, text ? schema.text(text) : null);
const document = children => schema.node('doc', null, children);
const state = text => EditorState.create({ schema, doc: document([paragraph(text)]), plugins: [history()] });
let first = state('First');
first = first.apply(first.tr.insertText(' edited', 6));
const cache = new SegmentEditorCache(2, 20000);
cache.put(0, first);
let second = state('Second');
second = second.apply(second.tr.insertText(' changed', 7));
cache.put(1, second);
first = cache.peek(0);
assert.equal(undo(first, tr => { first = first.apply(tr); }), true);
assert.equal(first.doc.textContent, 'First');
cache.put(0, first);
first = cache.peek(0);
assert.equal(redo(first, tr => { first = first.apply(tr); }), true, 'redo branch survives a cached segment state');
assert.equal(first.doc.textContent, 'First edited');
assert.equal(cache.peek(1).doc.textContent, 'Second changed', 'undo in one cached state never edits another segment');
cache.put(2, state('Third'));
assert.equal(cache.peek(1), undefined, 'least recently stored state is evicted');
assert.ok(cache.snapshot().indexes.length <= 2);
cache.clear();
assert.equal(cache.peek(0), undefined, 'new document can release every prior history state');
const smallBudget = new SegmentEditorCache(8, 5000);
let deleted = state('x'.repeat(10000));
deleted = deleted.apply(deleted.tr.delete(1, 10001));
smallBudget.put(0, deleted);
assert.equal(smallBudget.snapshot().indexes.length, 0, 'a large deleted slice in history counts toward the byte budget');

const mixed = document([
  schema.node('heading', { id: 'h0' }, schema.text('Heading')),
  paragraph('Alpha beta'), schema.node('horizontalRule'),
  schema.node('blockquote', null, [paragraph('Quoted text'), paragraph('Two lines')]),
  schema.node('paragraph', null, [schema.text('Image '), schema.node('image')]),
  schema.node('codeBlock', { language: 'javascript' }, schema.text('const a = 1;\nconst b = 2;')),
]);
const expected = {};
CharacterCount.config.onBeforeCreate.call({ storage: expected, editor: { state: { doc: mixed } }, options: { mode: 'textSize' } });
const statistics = new EditorStatisticsCache();
assert.deepEqual(statistics.count(mixed), { characters: expected.characters(), words: expected.words() }, 'all block/atom statistics match the existing CharacterCount definition');
const many = document(Array.from({ length: 500 }, (_, index) => paragraph('paragraph ' + index)));
statistics.count(many);
const prototype = Object.getPrototypeOf(many);
const textBetween = prototype.textBetween;
let reads = 0;
prototype.textBetween = function(...args) { reads++; return textBetween.apply(this, args); };
try {
  statistics.count(many);
  assert.equal(reads, 0, 'unchanged block counts are cached');
  const changed = EditorState.create({ schema, doc: many }).tr.insertText('x', 3).doc;
  statistics.count(changed);
  assert.equal(reads, 2, 'editing one top-level block reads only that block for characters and words');
} finally { prototype.textBetween = textBetween; }

const structured = document([
  schema.node('heading', { id: 'h0' }, schema.text('Heading')),
  paragraph('ordinary prose'), schema.node('heading', { id: 'h1' }, schema.text('Next')),
  schema.node('codeBlock', { language: 'javascript' }, schema.text('const value = 1;')),
]);
const editorState = EditorState.create({ schema, doc: structured });
const positions = [];
structured.forEach((node, pos) => positions.push(pos));
let transaction = editorState.tr.insertText('x', positions[1] + 3);
assert.deepEqual(changedBlockNodes(transaction.doc, changedDocumentRanges(transaction), 'heading'), [], 'ordinary prose edits do not invalidate headings');
transaction = editorState.tr.insertText('x', positions[0] + 3);
assert.equal(changedBlockNodes(transaction.doc, changedDocumentRanges(transaction), 'heading').length, 1);
transaction = editorState.tr.addMark(positions[0] + 1, positions[0] + 4, schema.marks.strong.create());
assert.equal(changedBlockNodes(transaction.doc, changedDocumentRanges(transaction), 'heading').length, 1, 'empty position maps still identify mark changes');
transaction = editorState.tr.setNodeMarkup(positions[3], schema.nodes.paragraph);
const ranges = changedDocumentRanges(transaction);
assert.equal(changedBlockNodes(transaction.before, ranges.map(range => ({ from: range.oldFrom, to: range.oldTo })), 'codeBlock').length, 1);
assert.equal(changedBlockNodes(transaction.doc, ranges, 'codeBlock').length, 0, 'changing code into prose removes its code decorations');
console.log('editor state cache: undo/redo, eviction/history budget, shared statistics and changed-block ranges passed');
