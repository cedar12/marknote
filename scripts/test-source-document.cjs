const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(relative) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('exports', 'module', 'require', compiled)(module.exports, module, require);
  return module.exports;
}
const { SourceDocument, sourceTextareaInput, sourceTextareaValue, textareaOffsetToSource, sourceOffsetToTextarea, sourcePreviewWindow, SOURCE_PREVIEW_CHARACTER_LIMIT } = load('src/utils/sourceDocument.ts');
const selection = (from, to = from) => ({ from, to, direction: 'forward' });
const raw = '\uFEFF#  Title\r\n\r\n<!-- keep -->\n* __bold__\r\n\r\n[ref]: <relative.md> "Title"\r\n\r\n~~\n中文 😀\r\n';
const original = new SourceDocument(raw);
assert.equal(original.text, raw);
assert.equal(original.undoAvailable, false);
const visible = sourceTextareaValue(raw);
for (let index = 0; index <= visible.length; index++) assert.equal(sourceOffsetToTextarea(raw, textareaOffsetToSource(raw, index)), index, 'UTF16 textarea/raw offsets round-trip across CRLF and emoji');
const start = visible.indexOf('Title') + 5;
const input = sourceTextareaInput(raw, visible.slice(0, start) + ' edited\nline' + visible.slice(start), selection(start + 12));
assert.equal(input.text, raw.replace('Title', 'Title edited\r\nline'), 'editing retains every unchanged mixed newline and uses the document newline for inserted lines');
original.apply(input.text, input.selection);
assert.equal(original.undo(), true); assert.equal(original.text, raw); assert.equal(original.redo(), true); assert.equal(original.text, input.text);
console.log('PASS exact raw text, mixed newline input and raw/textarea UTF16 offsets');

const typing = new SourceDocument('Body'); typing.setSelection(selection(4));
typing.apply('Body a', selection(6), 'insertText', 100);
typing.apply('Body ab', selection(7), 'insertText', 200);
typing.apply('Body abc', selection(8), 'insertText', 300);
assert.equal(typing.historyInfo().undo, 1);
typing.undo(); assert.equal(typing.text, 'Body'); typing.redo(); assert.equal(typing.text, 'Body abc');
typing.boundary(); typing.apply('Body abc中', selection(9), 'composition', 400); typing.apply('Body abc中文', selection(10), 'composition', 500);
typing.undo(); assert.equal(typing.text, 'Body abc', 'one IME session has one undo boundary');
const replace = new SourceDocument('First 😀 target\nSecond target');
const positions = [...replace.text.matchAll(/target/g)].map(match => ({ from: match.index, to: match.index + 6, replacement: 'replacement' }));
replace.replace(positions); assert.equal(replace.historyInfo().undo, 1); assert.equal(replace.text, 'First 😀 replacement\nSecond replacement');
replace.undo(); assert.equal(replace.text, 'First 😀 target\nSecond target');
const old = replace.text;
assert.equal(replace.replace([{ from: 0, to: 5, replacement: 'a' }, { from: 2, to: 6, replacement: 'b' }]), false); assert.equal(replace.text, old);
assert.equal(replace.replace([{ from: 0, to: 0, replacement: 'x'.repeat(200) }], 100), false); assert.equal(replace.text, old, 'oversized replacement is rejected before mutating text or history');
const distant = new SourceDocument('target ' + 'x'.repeat(9 * 1024 * 1024) + ' target');
const distantOriginal = distant.text;
assert.equal(distant.replace([{ from: 0, to: 6, replacement: 'first' }, { from: distant.text.length - 6, to: distant.text.length, replacement: 'last' }]), true);
assert.ok(distant.historyInfo().bytes < 500, 'distant replacement history stores only changed ranges');
assert.equal(distant.undo(), true); assert.equal(distant.text, distantOriginal);
assert.equal(distant.redo(), true); assert.ok(distant.text.startsWith('first ') && distant.text.endsWith(' last'));
const bounded = new SourceDocument('Start', 3, 500);
for (let index = 0; index < 20; index++) bounded.apply('Value ' + index, selection(0));
assert.ok(bounded.historyInfo().undo <= 3 && bounded.historyInfo().bytes <= 500);
console.log('PASS grouped typing/IME, single-transaction replacements, invalid/oversized ranges and bounded history');

const resources = new SourceDocument('![local](old.png)\nBody');
resources.apply(resources.text + ' edited', selection(resources.text.length + 7));
resources.undo();
resources.rewrite(text => text.replace(/old\.png/g, 'current-directory.png'));
assert.equal(resources.historyInfo().redo, 1, 'rebasing retains redo instead of adding a history step');
resources.redo(); assert.equal(resources.text, '![local](current-directory.png)\nBody edited');
resources.undo(); assert.equal(resources.text, '![local](current-directory.png)\nBody');
assert.equal(resources.renderedText, '![local](current-directory.png)\nBody');
for (const undone of [false, true]) {
  const growing = new SourceDocument('![image](a.png)\nBody', 3, 350);
  growing.apply('![image](b.png)\nBody', selection(20));
  if (undone) growing.undo();
  growing.rewrite(text => text.replace('a.png', 'alpha/'.repeat(100) + 'a.png').replace('b.png', 'beta/'.repeat(100) + 'b.png'));
  assert.ok(growing.historyInfo().bytes <= 350, 'alias growth retains the joint undo/redo byte bound');
  assert.ok(growing.text.includes((undone ? 'alpha/' : 'beta/').repeat(100)), 'trimming history never changes the rewritten current document');
  assert.equal(undone ? growing.redoAvailable : growing.undoAvailable, false, 'a rewritten entry that cannot fit releases its branch');
}
const statistics = new SourceDocument('Alpha  beta\n中文 😀');
assert.deepEqual(statistics.statistics(), { characters: statistics.text.length, words: 3 });
const counts = statistics.statistics(); statistics.setSelection(selection(3));
assert.equal(statistics.statistics(), counts, 'selection-only changes reuse cached source counts');
console.log('PASS resource rewriting transforms raw/checkpoint/undo/redo consistently');

for (const content of ['x'.repeat(200000), '```unknown\n' + 'x'.repeat(200000) + '\n```', '# Heading\n\nBody\n\n'.repeat(20000)]) {
  const doc = new SourceDocument(content);
  for (const offset of [0, 70000, content.length - 1]) {
    const window = sourcePreviewWindow(doc, offset);
    assert.ok(window.content.length <= SOURCE_PREVIEW_CHARACTER_LIMIT);
    assert.equal(window.content, content.slice(window.from, window.to));
    assert.ok(window.from <= offset && window.to > offset, 'bounded preview includes the requested source location');
    assert.equal(window.limited, true);
  }
}
console.log('PASS bounded nearby preview for large prose, single lines and indivisible code fences');
