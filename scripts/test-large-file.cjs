const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'largeFile.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const largeFile = {};
new Function('exports', 'require', 'module', '__filename', '__dirname', compiled)(
  largeFile,
  require,
  { exports: largeFile },
  'largeFile.js',
  __dirname,
);

const paragraph = '# Heading\r\n\r\nA paragraph with **formatting**.\r\n\r\n';
const sourceDocument = paragraph.repeat(8000);
const segments = largeFile.splitMarkdownIntoSegments(sourceDocument, 4096);
assert.ok(segments.length > 1, 'large documents should be split');
assert.equal(segments.join(''), sourceDocument, 'untouched segments must reassemble exactly');
assert.ok(segments.every((segment) => segment.length >= 4096 || segment === segments.at(-1)));
assert.equal(largeFile.utf8ByteLength('MarkNote 文档 📝'), 20);

const fenced = [
  'Before\n\n',
  '````md\n',
  'content\n\n',
  '```\n',
  'still fenced\n',
  '````\n\n',
  'After\n',
].join('');
const fencedSegments = largeFile.splitMarkdownIntoSegments(fenced, 12);
assert.equal(fencedSegments.join(''), fenced);
assert.equal(fencedSegments.length, 2, 'blank lines inside fenced code must not split a segment');

assert.equal(
  largeFile.preserveBoundaryNewlines('edited\n', 'original\r\n\r\n'),
  'edited\r\n\r\n',
  'edited segments must preserve their boundary newline convention',
);

console.log('large-file segmentation: '+segments.length+' segments, exact reassembly verified');
