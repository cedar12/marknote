const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {appFixture,deferred,tick,fileVersion}=require('./test-document-lifecycle.cjs');
function version(text,mtimeNs='1') { return {exists:true,mtimeNs,size:Buffer.byteLength(text),hash:createHash('sha256').update(text).digest('hex')}; }
const missing={exists:false,mtimeNs:'0',size:0,hash:''};
const file='D:\\note.md';
async function run(){
  assert.equal(fileVersion.normalizeFileVersion({exists:true,mtimeNs:'1',size:4,hash:'bad'}),null);
  assert.equal(fileVersion.fileIdentity('\\\\?\\D:\\Notes\\A.md',true),'d:/notes/a.md');
  assert.equal(fileVersion.filePathFromArgument('file:///D:/notes/one%20%23%20%E4%B8%AD%E6%96%87.md',true),'D:/notes/one # 中文.md');
  assert.equal(fileVersion.filePathFromArgument('file://server/share/one.md',true),'\\\\server\\share\\one.md');
  assert.equal(fileVersion.filePathFromArgument('D:\\notes\\100%complete.md',true),'D:\\notes\\100%complete.md');
  assert.ok(fileVersion.sameFileContents(version('abc','1'),version('abc','2')),'timestamp-only changes do not create false content conflicts');
  assert.ok(!fileVersion.sameFileContents(version('abc'),version('abd')),'equal-sized modifications remain detectable by content hash');
  {
    const {app,control,editor}=appFixture(); app.isSave=true;
    const disk=version('# Disk');
    control.read=async path=>({code:0,info:path,data:'# Disk',version:disk,canonicalPath:file});
    assert.equal(await app.openMarkdownDocument(file),'opened');
    assert.equal(control.markdown,'# Disk'); assert.deepEqual({...app.fileVersion},disk);
    assert.equal(app.fileCanonicalPath,file); assert.equal(app.openError,null); assert.equal(editor.isEditable,true);
    assert.deepEqual([...app.recentFiles],[file]);
    app.setFilepath('D:/notes/forward.md');assert.equal(app.title,'forward.md');
    app.setFilepath(null);assert.equal(control.titles.at(-1),'MarkNote');
  }
  for(const renderFailure of [false,true]){
    const {app,control,editor,editorStore}=appFixture(); app.isSave=false; control.decision='giveUp';
    const baseline=version(control.markdown); app.fileVersion=baseline; app.fileCanonicalPath=file;
    app.recentFiles=['D:\\recent.md'];
    if(renderFailure){control.read=async()=>({code:0,data:'# new',version:version('# new'),canonicalPath:'D:\\new.md'});control.render=async()=>{throw Error('render failed');};}
    else control.read=async()=>({code:1,info:'read failed'});
    assert.equal(await app.openMarkdownDocument('D:\\new.md'),'failed');
    assert.equal(app.filepath,file); assert.equal(app.isSave,false); assert.equal(control.markdown,'# draft');
    assert.deepEqual({...app.fileVersion},baseline); assert.ok(app.openError.includes(renderFailure?'render failed':'read failed'));
    assert.equal(app.openFailedPath,'D:\\new.md');
    assert.equal(editor.isEditable,true); assert.equal(editorStore.renderingDocument,false); assert.equal(app.resourceTasks,0);
    assert.ok(control.captureForces.includes(true),'failed open restores the discarded dirty document recovery snapshot');
    assert.deepEqual([...app.recentFiles],['D:\\recent.md'],'read/render failures do not enter the recent-file list');
  }
  {
    const {app,control}=appFixture();app.autoSave=true;app.fileVersion=version(control.markdown);app.resourceTasks=1;
    assert.equal(await app.save(true),false);assert.equal(control.pickers,0,'resource jobs block native Save As');
    assert.equal(await app.save(false,undefined,{automatic:true}),false);assert.equal(control.writes,0);
    app.resourceTasks=0;
    await new Promise(resolve=>setTimeout(resolve,650));assert.equal(control.writes,1,'automatic saves retry once after resource jobs finish');
  }
  {
    const {app,control}=appFixture();const writing=deferred();control.write=()=>writing.promise;
    const first=app.save();await tick();const queued=app.save(true);
    const closing=app.prepareApplicationAction('close-queued-save');await tick();
    writing.resolve({code:0,version:version(control.markdown),canonicalPath:file});
    assert.equal(await first,true);assert.equal(await queued,false);assert.equal(control.pickers,0,'a queued Save As cannot bypass a new close lock');
    assert.equal((await closing).allowed,true);assert.equal(app.validateApplicationAction('close-queued-save'),true);
    app.releaseApplicationAction('close-queued-save');
  }
  {
    const {app,control}=appFixture();const writing=deferred();control.write=()=>writing.promise;
    const first=app.save();await tick();const queued=app.save(true);app.resourceTasks=1;
    writing.resolve({code:0,version:version(control.markdown),canonicalPath:file});
    assert.equal(await first,true);assert.equal(await queued,false);assert.equal(control.pickers,0,'queued Save As rechecks later resource jobs');
  }
  {
    const {app,control}=appFixture();app.guardUnsavedChanges=async()=>{app.markEdited();return true;};
    assert.equal(await app.openMarkdownDocument('D:\\new.md'),'cancelled','edits arriving as a guard resolves cannot be discarded');
    assert.equal(control.markdown,'# draft');assert.equal(app.filepath,file);
    let transitions=0;assert.equal(await app.runAfterUnsavedCheck(()=>{transitions++;}),false);assert.equal(transitions,0);
  }
  {
    const {app,control}=appFixture(); app.isSave=true;
    const reading=deferred(); control.read=()=>reading.promise;
    const opening=app.openMarkdownDocument('D:\\first.md'); await tick();
    assert.equal(await app.openMarkdownDocument('D:\\second.md'),'cancelled','overlapping opens cannot later replace an unrelated document');
    reading.resolve({code:0,data:'# first',version:version('# first'),canonicalPath:'D:\\first.md'});
    assert.equal(await opening,'opened'); assert.equal(app.filepath,'D:\\first.md');
  }
  {
    const {app,control}=appFixture(); app.isSave=true;
    app.fileVersion=version(control.markdown); app.fileCanonicalPath=file;
    const baseline={...app.fileVersion}; control.write=async(path,markdown,expected)=>{assert.deepEqual({...expected},baseline);return {code:0,info:path,version:version(markdown,'2'),canonicalPath:file};};
    app.markEdited(); assert.equal(await app.save(),true); assert.equal(app.fileVersion.mtimeNs,'2');
  }
  {
    const {app,control}=appFixture(); app.autoSave=true; app.fileVersion=version(control.markdown); app.fileCanonicalPath=file;
    control.write=async()=>({code:409,info:file,version:version('external'),canonicalPath:file});
    assert.equal(await app.save(false,undefined,{automatic:true}),false);
    assert.equal(app.isSave,false); assert.ok(app.fileConflict); assert.equal(control.clears,0);
    assert.ok(control.captureForces.includes(true));
    app.markEdited(); await new Promise(resolve=>setTimeout(resolve,650));
    assert.equal(control.writes,1,'conflict blocks automatic-save loops');
    assert.equal(await app.save(),false); assert.equal(control.writes,1,'manual save cannot bypass a known conflict');
  }
  {
    const {app,control}=appFixture(); app.fileVersion=version(control.markdown);app.fileCanonicalPath=file;
    app.observeFileVersion(file,file,version('external')); assert.ok(app.fileConflict);
    let expected; control.write=async(path,markdown,value)=>{expected=value;return {code:0,info:path,version:version(markdown,'3'),canonicalPath:file};};
    assert.equal(await app.overwriteFileAfterConflict(),true);
    assert.deepEqual({...expected},version('external'),'explicit overwrite matches the exact version last shown to the user');
    assert.equal(app.fileConflict,null);assert.equal(app.lifecycleBusy,false);
  }
  {
    const {app,control,editor}=appFixture();app.fileVersion=version(control.markdown);app.fileCanonicalPath=file;
    app.observeFileVersion(file,file,version('external'));
    control.write=async()=>({code:409,info:file,version:version('changed again'),canonicalPath:file});
    assert.equal(await app.overwriteFileAfterConflict(),false);assert.ok(app.fileConflict);
    assert.equal(app.fileConflict.version.hash,version('changed again').hash);assert.equal(editor.isEditable,true);assert.equal(app.isSave,false);
  }
  {
    const {app,control}=appFixture();app.fileVersion=version(control.markdown);app.fileCanonicalPath=file;
    app.observeFileVersion(file,file,missing); let expected;
    control.write=async(path,markdown,value)=>{expected=value;return {code:0,info:path,version:version(markdown),canonicalPath:file};};
    assert.equal(await app.overwriteFileAfterConflict(),true);assert.deepEqual({...expected},missing,'recreating a deleted file requires explicit absence approval');
  }
  {
    const {app,control}=appFixture();app.fileVersion=version(control.markdown);app.fileCanonicalPath=file;
    app.observeFileVersion(file,file,version('external')); app.isSave=false;
    control.read=async()=>({code:0,data:'external',version:version('external'),canonicalPath:file});
    assert.equal(await app.reloadFileAfterConflict(),true);assert.equal(control.markdown,'external');assert.equal(app.fileConflict,null);assert.equal(app.isSave,true);
  }
  {
    const {app,control,editor}=appFixture();app.fileVersion=version(control.markdown);app.fileCanonicalPath=file;
    app.observeFileVersion(file,file,version('external')); app.isSave=false;
    const clearing=deferred();control.clear=clearing.promise;
    const reloading=app.reloadFileAfterConflict();await tick();assert.equal(editor.isEditable,false);
    app.markEdited(); clearing.resolve(true);assert.equal(await reloading,false);
    await tick();assert.equal(control.markdown,'# draft');assert.equal(app.isSave,false);assert.equal(editor.isEditable,true);assert.ok(control.captureForces.includes(true));
  }
  {
    const {app,control}=appFixture();app.fileVersion=version(control.markdown);app.fileCanonicalPath=file;
    control.probe=async()=>({code:0,version:version('external'),canonicalPath:file});
    assert.equal(await app.checkFileForChanges(true),true);assert.ok(app.fileConflict);
    app.setFilepath('D:\\other.md',version('other'),'D:\\other.md');
    app.observeFileVersion(file,file,version('external'));assert.equal(app.fileConflict,null,'other documents cannot receive stale notifications');
  }
  console.log('File-version tests passed: baselines, open rollback, overlapping opens, conflicts, pause, conditional overwrite, deletion, and reload.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
