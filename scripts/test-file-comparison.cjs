const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createPinia,setActivePinia}=require('pinia');
const {reactive,markRaw}=require('vue');
const {load,deferred,tick,fileVersion}=require('./test-document-lifecycle.cjs');
const textDiff=load('src/utils/textDiff.ts');
const {compareText}=textDiff;
function version(text,stamp='1'){return {exists:true,mtimeNs:stamp,size:Buffer.byteLength(text),hash:createHash('sha256').update(text).digest('hex')};}
const path='D:\\notes\\shared.md';
function fixture(){
  setActivePinia(createPinia());
  const app=reactive({editRevision:3,filepath:path,fileCanonicalPath:path,fileVersion:version('saved'),
    fileConflict:{path,canonicalPath:path,version:version('disk'),detectedAt:1},platform:'windows',loading:false,
    lifecycleBusy:false,saving:false,exporting:false,resourceTasks:0});
  const control={local:'current\nfull source\nlast segment\n',disk:'disk\nfull source\nlast segment\n',reads:0};
  const editor=reactive({editor:markRaw({}),renderVersion:4,loading:false,renderingDocument:false,segmentLoading:false,
    navigatingToHeading:false,sourceComposing:false,getMarkdown:()=>control.local});
  control.read=async()=>({code:0,data:control.disk,version:version(control.disk),canonicalPath:path});
  const {useFileComparisonStore}=load('src/store/fileComparison.ts',{'./app':{useAppStore:()=>app},'./editor':{useEditorStore:()=>editor},
    '../api/file':{read:async target=>{assert.equal(target,path);control.reads++;return control.read(target);}},
    '../utils/fileVersion':fileVersion,'../utils/textDiff':textDiff});
  return {comparison:useFileComparisonStore(),app,editor,control};
}
async function run(){
  const basic=compareText('one\nold\nthree\n','one\nnew\nthree\n');
  assert.equal(basic.complete,true);assert.equal(basic.removed,1);assert.equal(basic.added,1);
  assert.equal(basic.rows.find(row=>row.kind==='remove').localLine,2);assert.equal(basic.rows.find(row=>row.kind==='add').diskLine,2);
  assert.equal(compareText('','').rows.length,0);assert.equal(compareText('a\n','a').removed,1);
  assert.equal(compareText('a\r\n','a\n').added,1,'line endings remain visible differences');
  assert.equal(compareText('a\n','').removed,1);assert.equal(compareText('','\n').added,1);
  // Repeated lines exercise bounded Myers, not only unique patience anchors.
  let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let trial=0;trial<1500;trial++){
    const left=Array.from({length:random()%15},()=>String(random()%4)+'\n');
    const right=Array.from({length:random()%15},()=>String(random()%4)+'\n');
    const result=compareText(left.join(''),right.join(''),{context:24,maxRows:1000});
    assert.equal(result.complete,true);assert.ok(!result.rows.some(row=>row.kind==='skip'));
    if(left.join('')===right.join('')){assert.equal(result.added,0);assert.equal(result.removed,0);continue;}
    const restored=[];let local=0,disk=0;
    for(const row of result.rows){
      if(row.kind!=='add'){assert.equal(row.localLine,++local);assert.equal(row.text+'\n',left[local-1]);}
      if(row.kind!=='remove'){assert.equal(row.diskLine,++disk);assert.equal(row.text+'\n',right[disk-1]);restored.push(row.text+'\n');}
    }
    assert.deepEqual(restored,right);assert.equal(local,left.length);
  }
  const huge=compareText('x'.repeat(8_000_000),'y'.repeat(8_000_000),{maxInputChars:4096});
  assert.equal(huge.complete,false);assert.equal(huge.limitedReason,'input');assert.ok(huge.rows.some(row=>row.reason==='input'));
  const unmatched=compareText(Array.from({length:5000},(_,i)=>'old '+i+'\n').join(''),Array.from({length:5000},(_,i)=>'new '+i+'\n').join(''));
  assert.equal(unmatched.complete,false);assert.equal(unmatched.limitedReason,'work');assert.equal(unmatched.added,0,'uncompared ranges are not guessed additions');
  assert.ok(unmatched.rows.some(row=>row.reason==='work'&&row.localCount===5000&&row.diskCount===5000));
  const rendered=compareText('',Array.from({length:2000},(_,i)=>'line '+i+'\n').join(''),{maxRows:20});
  assert.equal(rendered.complete,true);assert.equal(rendered.added,2000);assert.equal(rendered.rows.length,20);assert.ok(rendered.hiddenRows>1900);
  const long=compareText('old '+ 'x'.repeat(30000),'new '+ 'y'.repeat(30000),{maxLineLength:80});
  assert.equal(long.shortenedLines,2);assert.ok(long.rows.every(row=>row.text.length<=83));
  const context=compareText(Array.from({length:10000},(_,i)=>'line '+i+'\n').join(''),Array.from({length:10000},(_,i)=>(i===5000?'edit': 'line '+i)+'\n').join(''));
  assert.equal(context.complete,true);assert.equal(context.added,1);assert.ok(context.rows.length<20);
  console.log('PASS bounded patience/Myers, repeated lines, exact EOLs, input/work/display budgets and long lines');

  {
    const {comparison,app,control}=fixture();const before=JSON.stringify(app);
    assert.equal(await comparison.open(),true);assert.equal(JSON.stringify(app),before);
    assert.equal(comparison.result.removed,1);assert.equal(comparison.result.added,1);assert.equal(comparison.stale,false);
    assert.equal(control.local,'current\nfull source\nlast segment\n');assert.deepEqual({...comparison.diskVersion},version(control.disk));
    comparison.close();assert.equal(comparison.result,null);
  }
  for(const mutate of [app=>app.editRevision++,(_app,editor)=>editor.renderVersion++,app=>app.filepath='D:\\different.md',
    app=>app.fileCanonicalPath='D:\\different.md',app=>app.fileVersion=version('new baseline'),(_app,editor)=>editor.editor=markRaw({}),
    (_app,editor)=>editor.sourceComposing=true]){
    const {comparison,app,editor,control}=fixture();const reading=deferred();control.read=()=>reading.promise;
    const opening=comparison.open();await tick();mutate(app,editor);
    reading.resolve({code:0,data:'disk',version:version('disk'),canonicalPath:path});
    assert.equal(await opening,false);assert.equal(comparison.stale,true);assert.equal(comparison.errorKey,'fileComparisonChanged');assert.equal(comparison.pending,false);
    comparison.close();
  }
  {
    const {comparison,control}=fixture();const first=deferred();control.read=()=>first.promise;
    const late=comparison.open();await tick();comparison.close();control.read=async()=>({code:0,data:'fresh',version:version('fresh'),canonicalPath:path});
    assert.equal(await comparison.open(),true);const current=comparison.result;
    first.resolve({code:1,info:'stale error'});assert.equal(await late,false);assert.equal(comparison.result,current);assert.equal(comparison.errorKey,null);comparison.close();
  }
  {
    const {comparison,app,control}=fixture();assert.equal(await comparison.open(),true);
    app.fileConflict={...app.fileConflict,version:version(control.disk)};assert.equal(comparison.stale,false,'observing the compared version does not invalidate it');
    app.fileConflict={...app.fileConflict,version:version('changed again')};assert.equal(comparison.stale,true);
    control.disk='changed again';assert.equal(await comparison.refresh(),true);assert.equal(comparison.stale,false);comparison.close();
  }
  {
    const {comparison,control}=fixture();assert.equal(await comparison.open(),true);const result=comparison.result;
    control.read=async()=>{throw Error('read failed');};assert.equal(await comparison.refresh(),false);assert.equal(comparison.errorKey,'fileComparisonFailed');assert.equal(comparison.result,result);
    control.read=async()=>({code:0,data:'retry',version:version('retry'),canonicalPath:path});assert.equal(await comparison.refresh(),true);assert.equal(comparison.errorKey,null);comparison.close();
  }
  {
    const {comparison,control}=fixture();control.read=async()=>({code:0,data:'another doc',version:version('another doc'),canonicalPath:'D:\\other.md'});
    assert.equal(await comparison.open(),false);assert.equal(comparison.errorKey,'fileComparisonChanged');comparison.close();
  }
  {
    const {comparison,editor,control}=fixture();editor.sourceComposing=true;
    assert.equal(await comparison.open(),false);assert.equal(control.reads,0);assert.equal(comparison.errorKey,'fileComparisonBusy');
    editor.sourceComposing=false;assert.equal(await comparison.refresh(),true);comparison.close();
  }
  console.log('File comparison tests passed: read-only full-document snapshots, late reads, source IME, stale versions, canonical identity and retry.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
