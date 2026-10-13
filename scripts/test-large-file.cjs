const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const MarkdownIt = require('markdown-it');
const mathPlugin = require('markdown-it-katex');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'largeFile.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
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

const markdown = new MarkdownIt({ html: true }).use(mathPlugin);
const semanticDocuments = [
  '- Item\n\n  continued paragraph\n\n- Second item\n\nAfter\n\n',
  '1. Item\n\n   continued paragraph\n\n2. Second item\n\nAfter\n\n',
  '> Quote\n>\n> continued paragraph\n\nAfter\n\n',
  '<div>\nA\n\n<div>\nB\n\n</div>\n</div>\n\nAfter\n\n',
  'Before\n\n$$\nx + y\n\nz + w\n$$\n\nAfter\n\n',
  'Before\r\n\r\n- Item\r\n\r\n  continued paragraph\r\n\r\nAfter\r\n\r\n',
  'Before\r\r- Item\r\r  continued paragraph\r\rAfter\r\r',
];
for (const document of semanticDocuments) {
  const pieces = largeFile.splitMarkdownIntoSegments(document, 6, markdown);
  assert.equal(pieces.join(''), document, 'semantic segmentation must retain every original character');
  assert.equal(pieces.map(piece => markdown.render(piece)).join(''), markdown.render(document), 'segmentation must preserve Markdown block structure');
}
assert.equal(largeFile.splitMarkdownIntoSegments('$$\nx + y\n\nz + w\n$$\n\nAfter\n', 6)[0], '$$\nx + y\n\nz + w\n$$\n\n', 'fallback segmentation protects display math before editor creation');

const referenceDocument = '\uFEFF# [Heading][id]\r\n\r\n[text][id] ![image][photo]\r\n\r\n[id]: <https://example.com/a?b=1&c=2> "line one\nline two"\r\n[photo]: /image.png\r\n\r\n[id]: https://later.example.com\r\n';
const prepared = largeFile.prepareMarkdownSegments(referenceDocument, 12, markdown);
assert.ok(prepared.segments.length > 1);
assert.equal(prepared.segments.join(''), referenceDocument, 'render-only reference context must never enter saved source');
assert.equal(prepared.segments.map(piece => markdown.render(largeFile.withMarkdownReferences(piece, prepared.references))).join(''), markdown.render(referenceDocument), 'cross-segment links, images, titles and duplicate precedence must match a complete document');

const definitions = '[a\\]b]: <https://example.com/a(b)> "quoted \\\" title"\n\n';
const preserved = largeFile.preserveMarkdownReferences('# Edited', definitions, markdown);
const originalEnvironment = {};
const preservedEnvironment = {};
markdown.parse(definitions, originalEnvironment);
assert.equal(Object.keys(originalEnvironment.references).length, 1, 'escaped-label fixture must contain an actual definition');
markdown.parse(preserved, preservedEnvironment);
assert.deepEqual(preservedEnvironment.references, originalEnvironment.references, 'invisible reference definitions must survive editing their segment');
assert.equal(largeFile.preserveMarkdownReferences(preserved, definitions, markdown), preserved, 'preserving definitions is idempotent');
assert.ok(!largeFile.preserveMarkdownReferences('# Edited', '    [not-a-reference]: /code\n', markdown).includes('not-a-reference'), 'indented code must not become a reference definition');

console.log('large-file segmentation: '+segments.length+' segments, exact reassembly verified');
console.log('semantic blocks, cross-segment references and definition preservation verified');
