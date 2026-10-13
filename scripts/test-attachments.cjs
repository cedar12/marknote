const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname,'../src/utils/attachments.ts'),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
const loaded={exports:{}};
new Function('module','exports','require',compiled)(loaded,loaded.exports,require);
const {collectAttachmentReferences,rebaseMarkdownAttachments,rebaseMarkdownAttachmentOffsets,isLocalAttachment}=loaded.exports;
const markdown=[
  '# 附件 😀',
  '![图](<图片 空格.png> "标题")',
  '> ![引用][asset]',
  '',
  '[asset]: ./image.png "参考标题"',
  '',
  '| 名称 | 图片 |',
  '| --- | --- |',
  '| 表格 | ![表](./image.png) |',
  '',
  '```md',
  '![代码](./image.png)',
  '```',
  '',
  '`![行内代码](./image.png)`',
  '$![公式](./image.png)$',
  '',
  '<div><img alt="html" src="图片%20空格.png" /></div>',
  '<!-- <img src="ignored.png"> -->',
  '',
  '![远程](https://example.com/image.png)',
  '![内嵌](data:image/png;base64,aGVsbG8=)',
].join('\r\n');
const references=collectAttachmentReferences(markdown);
assert.equal(references.length,4,'only actual local images are collected');
assert.deepEqual(references.map(ref=>ref.source),['图片 空格.png','./image.png','./image.png','图片 空格.png']);
for(const ref of references) {
  const text=Buffer.from(markdown).subarray(ref.start,ref.end).toString();
  assert(!text.includes('\ufffd'),'UTF8 ranges never split Unicode');
  if(ref.syntax==='markdown')assert(text.startsWith(ref.prefix));
  else assert.equal(text,'图片%20空格.png');
}
assert.deepEqual(collectAttachmentReferences(markdown),references,'temporary parser rules are restored after each collection');
const rewritten=rebaseMarkdownAttachments(markdown,{'图片 空格.png':'copy.md.assets/photo.png','./image.png':'copy.md.assets/reference.png'});
assert(rewritten.includes('![图](<copy.md.assets/photo.png> "标题")'));
assert(rewritten.includes('> ![引用](<copy.md.assets/reference.png> "参考标题")'));
assert(rewritten.includes('<div><img alt="html" src="copy.md.assets/photo.png" /></div>'));
for(const literal of ['![代码](./image.png)','`![行内代码](./image.png)`','$![公式](./image.png)$','<!-- <img src="ignored.png"> -->','[asset]: ./image.png "参考标题"'])assert(rewritten.includes(literal));
assert.equal(rebaseMarkdownAttachments(markdown,{}),markdown);
assert.equal(rebaseMarkdownAttachments('![literal](constructor)',{'other.png':'copied.png'}),'![literal](constructor)','inherited object properties cannot become attachment aliases');
const plainParser=new (require('markdown-it'))({html:false});
assert.equal(collectAttachmentReferences('<img src="missing.png">',plainParser).length,0,'HTML disabled by document settings remains literal text');
assert.equal(rebaseMarkdownAttachments('<img src="original.png">',{'original.png':'copied.png'},plainParser),'<img src="original.png">');
assert.equal(collectAttachmentReferences('![local](file:///C:/draft-assets/image.png)').length,1);
for(const source of ['image.png','../image.png','C:/image.png','file:///tmp/image.png'])assert(isLocalAttachment(source));
for(const source of ['https://host/image.png','data:image/png;base64,foo','//host/image.png','#anchor','blob:url'])assert(!isLocalAttachment(source));
console.log('PASS attachment syntax, UTF8 spans, reference/table/HTML images, protected code/formulas, parser reuse and local URL policy');

const mappedSource='# 中文 😀\r\n![first][asset]\r\nBEFORE target\r\n![second](b.png)\r\nAFTER target\r\n\r\n[asset]: a.png "title"\r\n';
const aliases={'a.png':'copied-folder/a-much-longer.png','b.png':'copied-folder/b.png'};
const mappedText=rebaseMarkdownAttachments(mappedSource,aliases);
const offsetPoints=[0,mappedSource.indexOf('![first]'),mappedSource.indexOf('![first]')+'![first]'.length,
  mappedSource.indexOf('[asset]')+'[asset]'.length,mappedSource.indexOf('BEFORE'),mappedSource.indexOf('![second]'),
  mappedSource.indexOf('AFTER'),mappedSource.indexOf('[asset]:'),mappedSource.length];
assert.deepEqual(rebaseMarkdownAttachmentOffsets(mappedSource,aliases,offsetPoints),[0,mappedText.indexOf('![first]'),
  mappedText.indexOf('![first]')+'![first]'.length,mappedText.indexOf('\r\nBEFORE'),mappedText.indexOf('BEFORE'),
  mappedText.indexOf('![second]'),mappedText.indexOf('AFTER'),mappedText.indexOf('[asset]:'),mappedText.length],
  'caret offsets use full reference definitions after the caret and UTF16 lengths across multiple aliases');
const everyOffset=rebaseMarkdownAttachmentOffsets(mappedSource,aliases,Array.from({length:mappedSource.length+1},(_,i)=>i));
assert.ok(everyOffset.every((value,index)=>value>=0&&value<=mappedText.length&&(!index||value>=everyOffset[index-1])));
assert.deepEqual(rebaseMarkdownAttachmentOffsets('<img src="missing.png">',{'missing.png':'copy.png'},[0,8,22],plainParser),[0,8,22]);
const shortening='![label](<very-long-original-file-name.png>) tail';
const shorteningResult=rebaseMarkdownAttachments(shortening,{'very-long-original-file-name.png':'a.png'});
assert.deepEqual(rebaseMarkdownAttachmentOffsets(shortening,{'very-long-original-file-name.png':'a.png'},[0,shortening.indexOf(')')-1,shortening.indexOf(')')+1,shortening.length]),
  [0,shorteningResult.indexOf(')')+1,shorteningResult.indexOf(')')+1,shorteningResult.length],'inside positions clamp, while image end maps to replacement end');
const htmlSource='😀 <img src="a.png"> AFTER';const htmlResult=rebaseMarkdownAttachments(htmlSource,{'a.png':'copied-folder/a.png'});
assert.deepEqual(rebaseMarkdownAttachmentOffsets(htmlSource,{'a.png':'copied-folder/a.png'},[htmlSource.indexOf('a.png'),htmlSource.indexOf('a.png')+5,htmlSource.indexOf('AFTER')]),
  [htmlResult.indexOf('copied-folder'),htmlResult.indexOf('copied-folder')+'copied-folder/a.png'.length,htmlResult.indexOf('AFTER')]);
assert.deepEqual(rebaseMarkdownAttachmentOffsets('body',{},[-1,2,99,NaN]),[0,2,4,0]);
console.log('PASS exact UTF16 image/reference/HTML offset mapping, boundaries, shortening and document parser settings');

const sourceModule={exports:{}};
const sourceCompiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/utils/sourceDocument.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
new Function('module','exports','require',sourceCompiled)(sourceModule,sourceModule.exports,require);
const {SourceDocument}=sourceModule.exports;
const rawDocument=new SourceDocument(mappedSource);
const first=mappedSource.indexOf('target'),second=mappedSource.lastIndexOf('target');
rawDocument.setSelection({from:first,to:first+6,direction:'backward'});
assert.equal(rawDocument.replace([{from:first,to:first+6,replacement:'first replacement'},{from:second,to:second+6,replacement:'second replacement'}]),true);
const changed=mappedSource.slice(0,first)+'first replacement'+mappedSource.slice(first+6,second)+'second replacement'+mappedSource.slice(second+6);
assert.equal(rawDocument.text,changed);
rawDocument.rewrite(text=>rebaseMarkdownAttachments(text,aliases),(text,offsets)=>rebaseMarkdownAttachmentOffsets(text,aliases,offsets));
assert.equal(rawDocument.text,rebaseMarkdownAttachments(changed,aliases));assert.equal(rawDocument.historyInfo().undo,1);
assert.equal(rawDocument.undo(),true);assert.equal(rawDocument.text,mappedText);
assert.deepEqual(rawDocument.selection,{from:mappedText.indexOf('target'),to:mappedText.indexOf('target')+6,direction:'backward'});
const nextAliases={'copied-folder/a-much-longer.png':'final/a.png','copied-folder/b.png':'final/b.png'};
rawDocument.rewrite(text=>rebaseMarkdownAttachments(text,nextAliases),(text,offsets)=>rebaseMarkdownAttachmentOffsets(text,nextAliases,offsets));
assert.equal(rawDocument.historyInfo().redo,1);assert.equal(rawDocument.redo(),true);
assert.equal(rawDocument.text,rebaseMarkdownAttachments(rebaseMarkdownAttachments(changed,aliases),nextAliases));
assert.equal(rawDocument.undo(),true);assert.equal(rawDocument.text,rebaseMarkdownAttachments(mappedText,nextAliases));
assert.ok(rawDocument.historyInfo().bytes<1000,'rebasing distant changes retains sparse undo entries');
console.log('PASS attachment aliases preserve sparse-batch source undo/redo and backward selection through repeated Save As');

const pathEditBefore='![x](a.png)\nBody',pathEditAfter='![x](b.png)\nBody';
const pathAliases={'a.png':'folder/aaaa.png','b.png':'folder/bbbb.png'};
const pathEdit=new SourceDocument(pathEditBefore);pathEdit.apply(pathEditAfter,{from:7,to:7,direction:'none'});
pathEdit.rewrite(text=>rebaseMarkdownAttachments(text,pathAliases),(text,offsets)=>rebaseMarkdownAttachmentOffsets(text,pathAliases,offsets));
assert.equal(pathEdit.undo(),true);assert.equal(pathEdit.text,rebaseMarkdownAttachments(pathEditBefore,pathAliases),'an edit inside image syntax retains its transformed undo change');
assert.equal(pathEdit.redo(),true);assert.equal(pathEdit.text,rebaseMarkdownAttachments(pathEditAfter,pathAliases));
console.log('PASS transformed edits inside image paths preserve Undo and Redo');
