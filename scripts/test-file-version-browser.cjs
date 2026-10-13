/* Real Tiptap + stores in Chromium; the file IPC is a shared, conditional mock. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function playwright(){for(const value of [process.env.MARKNOTE_PLAYWRIGHT_PATH,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{return require(value);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}throw Error('Playwright is required.');}
function options(chromium){if(process.env.MARKNOTE_BROWSER_PATH)return {executablePath:process.env.MARKNOTE_BROWSER_PATH};if(fs.existsSync(chromium.executablePath()))return {};const executablePath=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);if(!executablePath)throw Error('Chromium is required.');return {executablePath};}
const harness=String.raw`<template><main :inert="app.lifecycleBusy"><EditorContent :editor="instance" /></main><p role="status">{{ app.fileConflict ? 'Conflict' : 'Current' }}</p></template>
<script setup>
import {onMounted,onBeforeUnmount,nextTick} from 'vue';
import {Editor,EditorContent} from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {Markdown} from '/src/extensions/markdown';
import {useEditorStore} from '/src/store/editor';
import {useAppStore} from '/src/store/app';
import {useDraftsStore} from '/src/store/drafts';
const app=useAppStore();const document=useEditorStore();const drafts=useDraftsStore();
app.loading=false;app.isSave=true;
const instance=new Editor({content:'',injectCSS:false,extensions:[StarterKit,Image.configure({inline:true}),Markdown.configure({html:true})],onUpdate(){document.markCurrentSegmentEdited();app.markEdited();}});
document.setEditor(instance);
onMounted(()=>drafts.init());
window.__versionTest={
  snapshot(){return {ready:drafts.registered,markdown:document.getMarkdown(),version:app.fileVersion,filepath:app.filepath,dirty:!app.isSave,conflict:app.fileConflict,error:app.openError,busy:app.lifecycleBusy,resources:app.resourceTasks,editable:instance.isEditable,json:instance.getJSON(),records:Object.keys(localStorage).filter(key=>key.startsWith('marknote.draft.')).map(key=>JSON.parse(localStorage.getItem(key))),calls:window.__versionNative.calls};},
  async open(path){return app.openMarkdownDocument(path);},
  async edit(text){instance.commands.insertContent(text);await nextTick();},
  async fixture(text){await document.setContent(text);app.markEdited();await nextTick();},
  save(copy=false){return app.save(copy);},
  check(){return app.checkFileForChanges(true);},
  reload(){return app.reloadFileAfterConflict();},
  overwrite(){return app.overwriteFileAfterConflict();},
  async external(text){return window.__versionNative.external(text);},
  async native(flag){Object.assign(window.__versionNative,flag);},
  async resources(value){app.resourceTasks=value;},
  async auto(value){app.autoSave=value;},
  saveAuto(){return app.save(false,undefined,{automatic:true});},
  undo(){return instance.commands.undo();},
};
onBeforeUnmount(()=>{drafts.dispose();document.setEditor(undefined);instance.destroy();});
</script><style>body{margin:0;font-family:sans-serif}main{padding:32px}img{width:16px;height:16px}</style>`;
function nativeMock(){
  window.os='windows';window.isTauri=false;
  const file='C:\\notes\\shared.md';const key='file-version-browser-disk';
  const state={calls:[],failRead:false,changeBeforeSave:false};window.__versionNative=state;
  async function version(markdown,stamp){const bytes=new TextEncoder().encode(markdown);const digest=await crypto.subtle.digest('SHA-256',bytes);return {exists:true,mtimeNs:String(stamp),size:bytes.length,hash:Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')};}
  async function disk(){const stored=localStorage.getItem(key);if(stored)return JSON.parse(stored);const record={markdown:'# Shared\n\nOriginal\n',stamp:1};record.version=await version(record.markdown,record.stamp);localStorage.setItem(key,JSON.stringify(record));return record;}
  async function replace(markdown){const previous=await disk();const record={markdown,stamp:previous.stamp+1,version:await version(markdown,previous.stamp+1)};localStorage.setItem(key,JSON.stringify(record));return record;}
  state.external=replace;
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'window_1'},currentWebview:{label:'window_1'}},convertFileSrc:value=>value,transformCallback:()=>1,unregisterCallback(){},async invoke(command,args={}){
    state.calls.push({command,args});
    if(command==='get_config')return {code:0,data:{}};
    if(command==='read_md'){if(state.failRead||args.path!==file)return {code:1,info:'Injected unreadable document'};const record=await disk();return {code:0,info:file,data:record.markdown,version:record.version,canonicalPath:file};}
    if(command==='probe_file_version'){const record=await disk();return {code:0,info:file,version:record.version,canonicalPath:file};}
    if(command==='save_md')return navigator.locks.request('file-version-native-save',async()=>{
      if(state.changeBeforeSave){state.changeBeforeSave=false;await replace('Another latest external edit');}
      const record=await disk();if(!args.expectedVersion||args.expectedVersion.hash!==record.version.hash)return {code:409,info:file,version:record.version,canonicalPath:file};
      const saved=await replace(args.md);return {code:0,info:file,version:saved.version,canonicalPath:file};
    });
    if(command==='save_as_md'){const copied=args.md.replace(/old\.png/g,'copy.md.assets/image.png');const mapping=args.md.includes('old.png')?{'old.png':'copy.md.assets/image.png'}:undefined;return {code:0,info:'C:\\notes\\copy.md',data:copied,version:await version(copied,99),canonicalPath:'C:\\notes\\copy.md',attachmentMapping:mapping};}
    if(command==='plugin:dialog|message')return args.buttons?.OkCancelCustom?.[0]||args.buttons?.YesNoCancelCustom?.[0]||args.buttons?.OkCustom||'Ok';
    if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|'))return;
    throw Error('Unexpected native command '+command);
  }};
}
async function main(){
  const {chromium}=playwright();const {build,preview}=await import('vite');const vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.file-version-browser-test-'));let server,browser;const errors=[];
  try{
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';import {createPinia} from 'pinia';import i18n from '/src/i18n';import Harness from './Harness.vue';createApp(Harness).use(createPinia()).use(i18n).mount('#app');");
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:"></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0,strictPort:false}};
    console.log('Building file-version browser harness');await build(config);server=await preview(config);
    const url=`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    browser=await chromium.launch({headless:true,...options(chromium)});const context=await browser.newContext();await context.addInitScript(nativeMock);
    await context.route('**/*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
    const first=await context.newPage();const second=await context.newPage();
    for(const page of [first,second]){page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForFunction(()=>window.__versionTest?.snapshot().ready);}
    const api=(page,method,arg)=>page.evaluate(({method,arg})=>window.__versionTest[method](arg),{method,arg});
    const file='C:\\notes\\shared.md';
    for(const page of [first,second])assert.equal(await api(page,'open',file),'opened');
    const baseline=(await api(second,'snapshot')).version;assert.ok(baseline.hash.length===64);
    await api(first,'edit','First window text');assert.equal(await api(first,'save'),true);
    await api(second,'edit','Second window text');assert.equal(await api(second,'save'),false);
    let state=await api(second,'snapshot');assert.equal(state.dirty,true);assert.ok(state.conflict);assert.ok(state.records.some(record=>record.markdown.includes('Second window text')));
    assert.ok((await first.evaluate(()=>JSON.parse(localStorage.getItem('file-version-browser-disk')))).markdown.includes('First window text'));
    console.log('PASS two real editors preserve the losing window content and recovery draft');
    const writes=state.calls.filter(call=>call.command==='save_md').length;
    await api(second,'auto',true);await api(second,'edit','More local content');await second.waitForTimeout(800);
    assert.equal((await api(second,'snapshot')).calls.filter(call=>call.command==='save_md').length,writes);
    await api(second,'auto',false);assert.equal(await api(second,'reload'),true);state=await api(second,'snapshot');assert.equal(state.dirty,false);assert.ok(!state.markdown.includes('Second window text'));
    console.log('PASS conflict pauses automatic save; confirmed reload adopts the disk baseline');
    await api(second,'edit','Approved local copy');await api(first,'external','External edit before confirmation');await api(second,'check');
    await api(second,'native',{changeBeforeSave:true});assert.equal(await api(second,'overwrite'),false);
    assert.equal((await second.evaluate(()=>JSON.parse(localStorage.getItem('file-version-browser-disk')))).markdown,'Another latest external edit');
    assert.equal((await api(second,'snapshot')).dirty,true);assert.equal(await api(second,'overwrite'),true);
    console.log('PASS overwrite approval remains conditional when the disk changes again');
    const old=await api(first,'snapshot');await api(first,'native',{failRead:true});assert.equal(await api(first,'open','C:\\notes\\missing.md'),'failed');
    state=await api(first,'snapshot');assert.equal(state.markdown,old.markdown);assert.equal(state.filepath,old.filepath);assert.deepEqual(state.version,old.version);assert.ok(state.error);
    await api(first,'native',{failRead:false});
    console.log('PASS failed open preserves the real editor document, path, and version');
    await api(second,'resources',1);const before=(await api(second,'snapshot')).calls.filter(call=>call.command==='save_as_md').length;
    assert.equal(await api(second,'save',true),false);assert.equal((await api(second,'snapshot')).calls.filter(call=>call.command==='save_as_md').length,before);
    await api(second,'resources',0);
    await api(second,'fixture','![x](old.png)');await api(second,'edit','Added text');const json=(await api(second,'snapshot')).json;
    assert.equal(await api(second,'save',true),true);state=await api(second,'snapshot');assert.deepEqual(state.json,json);assert.ok(state.markdown.includes('copy.md.assets/image.png'));assert.equal(await api(second,'undo'),true);
    console.log('PASS pending resources block Save As; attachment mapping preserves document and Undo history');
    assert.deepEqual(errors,[]);console.log('File-version browser checks passed');
  }finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));const absolute=path.resolve(temporary);if(path.dirname(absolute)===root&&path.basename(absolute).startsWith('.file-version-browser-test-'))fs.rmSync(absolute,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
