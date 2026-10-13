const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/documentSearch.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {};
new Function('exports', 'require', 'module', compiled)(exportsObject, require, { exports: exportsObject });
const { scanDocument, replaceSourceMatches } = exportsObject;
async function main() {
  let found = await scanDocument('😀\nfirst <b>\nsecond <B>', '<b>', false);
  assert.deepEqual(found.results.map(({from,to,line,column})=>({from,to,line,column})), [
    {from:9,to:12,line:2,column:7},{from:20,to:23,line:3,column:8},
  ]);
  assert.equal(found.results[0].matched, '<b>', 'Snippets retain literal HTML; the Vue component escapes interpolation');
  assert.equal((await scanDocument('İ i I ı K k', 'i', false)).results.map(match=>match.from).join(','),'2,4', 'Unicode folds cannot shift offsets');
  assert.deepEqual((await scanDocument('K k', 'k', false)).results.map(match=>match.from),[0,2]);
  assert.equal((await scanDocument('A.a Axa', 'A.a', true)).results.length,1,'Literal punctuation is escaped');
  const boundary='x'.repeat(32767)+'needle'+'y'.repeat(40000);
  assert.equal((await scanDocument(boundary,'needle',true)).results[0].from,32767);
  assert.deepEqual((await scanDocument('a'.repeat(32775),'aaa',true,{limit:12000})).results.slice(-3).map(match=>match.from),[32766,32769,32772]);
  assert.equal((await scanDocument('aa aa aa','aa',true,{limit:2})).truncated,true);
  assert.equal((await scanDocument('aa aa','aa',true,{limit:2})).truncated,false);
  let cancelled=false;
  found=await scanDocument('x'.repeat(80000)+'needle','needle',true,{cancelled:()=>cancelled,progress:()=>cancelled=true});
  assert.equal(found.cancelled,true); assert.equal(found.results.length,0);
  found=await scanDocument('one\ntwo\none','one',true);
  assert.equal(replaceSourceMatches('one\ntwo\none',found.results,'$&<b>'),'$&<b>\ntwo\n$&<b>','Replacement stays literal');
  assert.throws(()=>replaceSourceMatches('text',[{from:2,to:4},{from:1,to:2}],''),/invalid_source_ranges/);
  await assert.rejects(()=>scanDocument('text','x'.repeat(257),false),/searchQueryTooLong/);
  console.log('PASS whole-document search: literal/Unicode UTF16 positions, segment/chunk boundaries, non-overlap, bounded results, cancellation and literal replacement');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
