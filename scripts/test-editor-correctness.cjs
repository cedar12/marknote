const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Schema } = require('@tiptap/pm/model');
const { EditorState, TextSelection } = require('@tiptap/pm/state');
const { history, undo } = require('@tiptap/pm/history');
const { MarkdownSerializer } = require('prosemirror-markdown');
const MarkdownIt = require('markdown-it');

function loadSource(relativePath) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(module.exports, require, module);
  return module.exports;
}

const { SearchAndReplace, searchAndReplacePluginKey } = loadSource('src/extensions/searchAndReplace.ts');
const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'text*' }, text: {} }, marks: { strong: {} } });
const editor = { storage: { searchAndReplace: SearchAndReplace.config.addStorage.call({}) } };
const plugin = SearchAndReplace.config.addProseMirrorPlugins.call({ editor, options: SearchAndReplace.config.addOptions.call({}) })[0];
const rawCommands = SearchAndReplace.config.addCommands.call({ options: SearchAndReplace.config.addOptions.call({}) });
function setDocument(text) {
  editor.state = EditorState.create({ schema, plugins: [plugin, history()], doc: schema.node('doc', null, [schema.node('paragraph', null, text ? schema.text(text) : null)]) });
}
function run(name, ...args) {
  const tr = editor.state.tr;
  const result = rawCommands[name](...args)({ editor, state: editor.state, tr, dispatch: () => {} });
  editor.state = editor.state.apply(tr);
  return result;
}
function select(index) {
  run('setSearchIndex', index);
  const range = editor.storage.searchAndReplace.results[index];
  editor.state = editor.state.apply(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, range.from, range.to)));
}

setDocument('foo foo foo');
run('setSearchTerm', 'foo');
run('setReplaceTerm', 'bar');
select(2);
assert.equal(run('replace'), true);
assert.equal(editor.state.doc.textContent, 'foo foo bar', 'single replace changes the selected third match');
assert.equal(editor.storage.searchAndReplace.index, 0, 'replacing the last match wraps to the first remaining result');
assert.equal(undo(editor.state, tr => { editor.state = editor.state.apply(tr); }), true);
assert.equal(editor.state.doc.textContent, 'foo foo foo', 'single replace is undoable');
select(1);
run('replace');
assert.equal(editor.state.doc.textContent, 'foo bar foo', 'middle match replacement must not change the first match');
assert.equal(editor.storage.searchAndReplace.index, 1, 'replacement advances to the following match');
const highlighted = plugin.getState(editor.state).find().filter(decoration => decoration.type.attrs.class.includes('current-result'));
assert.equal(highlighted.length, 1);
assert.equal(highlighted[0].from, editor.storage.searchAndReplace.results[1].from, 'current decoration follows navigation');

run('setSearchTerm', '');
assert.deepEqual(editor.storage.searchAndReplace.results, [], 'clearing search clears result positions');
assert.equal(plugin.getState(editor.state).find().length, 0);
assert.equal(run('replace'), false);
assert.equal(run('replaceAll'), false);
assert.equal(editor.state.doc.textContent, 'foo bar foo', 'empty search cannot modify old matches');

run('setSearchTerm', 'foo');
setDocument('different segment');
assert.deepEqual(editor.storage.searchAndReplace.results, [], 'a fresh editor state must not retain results from another segment');
assert.equal(run('replace'), false);
setDocument('foo foo foo');
run('setReplaceTerm', 'longer replacement');
assert.equal(run('replaceAll'), true);
assert.equal(editor.state.doc.textContent, 'longer replacement longer replacement longer replacement');
assert.equal(undo(editor.state, tr => { editor.state = editor.state.apply(tr); }), true);
assert.equal(editor.state.doc.textContent, 'foo foo foo', 'replace all is one undo operation');
run('setReplaceTerm', '');
run('replaceAll');
assert.equal(editor.state.doc.textContent, '  ', 'deleting all matches preserves surrounding spaces');
run('setSearchTerm', ' ');
assert.equal(editor.storage.searchAndReplace.results.length, 2, 'literal whitespace can be searched');
setDocument('[a] [a]');
run('setSearchTerm', '[a]');
assert.equal(editor.storage.searchAndReplace.results.length, 2, 'regular expression characters are literal by default');
const beforeCan = { ...editor.storage.searchAndReplace };
rawCommands.setSearchTerm('changed')({ editor, tr: editor.state.tr, dispatch: undefined });
assert.deepEqual(editor.storage.searchAndReplace, beforeCan, 'capability checks do not mutate search storage');
setDocument('foo bar');
run('setReplaceTerm', 'replaced');
const chained = editor.state.tr;
const chainProps = { editor, state: editor.state, tr: chained, dispatch: () => {} };
rawCommands.setSearchTerm('bar')(chainProps);
rawCommands.replaceAll()(chainProps);
editor.state = editor.state.apply(chained);
assert.equal(editor.state.doc.textContent, 'foo replaced', 'chained query changes use the current query instead of stale positions');
run('setSearchTerm', 'foo');
editor.isEditable = false;
assert.equal(run('replace'), false);
assert.equal(run('replaceAll'), false);
assert.equal(editor.state.doc.textContent, 'foo replaced', 'read-only editor locks also block explicit replace transactions');
editor.isEditable = true;

const codeBlock = loadSource('src/extensions/markdown/extensions/nodes/code-block.js').default;
const codeSchema = new Schema({ nodes: { doc: { content: 'codeBlock+' }, codeBlock: { content: 'text*', attrs: { language: { default: null } }, code: true }, text: {} } });
const serializer = new MarkdownSerializer({ codeBlock: codeBlock.storage.markdown.serialize }, {});
const markdown = new MarkdownIt();
for (const [content, language] of [
  ['before\n```\nafter', 'markdown'],
  ['``````\n```\nend', 'txt'],
  ['~~~~~~\n~~~\nend', 'language`with`backticks'],
  ['plain text\n', null],
  ['', null],
  [('a`b '.repeat(150000)), 'txt'],
]) {
  const doc = codeSchema.node('doc', null, [codeSchema.node('codeBlock', { language }, content ? codeSchema.text(content) : null)]);
  const saved = serializer.serialize(doc);
  const tokens = markdown.parse(saved, {});
  assert.equal(tokens.length, 1, 'saved code must remain exactly one fenced block');
  assert.equal(tokens[0].type, 'fence');
  assert.equal(tokens[0].content, content && !content.endsWith('\n') ? content + '\n' : content, 'every code character survives save and reopen');
  assert.equal(tokens[0].info, language || '');
}
console.log('editor correctness: current replacement, clear/reset, navigation, undo, literal search and safe code fences passed');
