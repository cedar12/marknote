/* Real search/sidebar/source workspace and document actions; native read-only IPC is mocked. */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const root = path.resolve(__dirname, '..');
function playwright() { for (const value of [process.env.MARKNOTE_PLAYWRIGHT_PATH,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) { try{return require(value);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;} } throw new Error('Set MARKNOTE_PLAYWRIGHT_PATH.'); }
const harness=String.raw`<template><div class="test-search-layout"><Sidebar /><main><EditorContent v-show="editor.sourceMode==='wysiwyg'" :editor="instance" /><SourceWorkspace v-show="editor.sourceMode!=='wysiwyg'" /></main></div></template>
<script setup>
import { nextTick } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import MarkdownIt from 'markdown-it';
import { Markdown } from '/src/extensions/markdown';
import Sidebar from '/src/components/sidebar/Sidebar.vue';
import SourceWorkspace from '/src/components/source/SourceWorkspace.vue';
import { useEditorStore } from '/src/store/editor';
import { useAppStore } from '/src/store/app';
import { useDocumentSearchStore } from '/src/store/documentSearch';
import { useFileComparisonStore } from '/src/store/fileComparison';
import { findThemeByType, setTheme } from '/src/theme';
import i18n from '/src/i18n';
const editor=useEditorStore(),app=useAppStore(),search=useDocumentSearchStore(),comparison=useFileComparisonStore();
window.__searchNative.render = markdown => new MarkdownIt().render(markdown);
const instance=new Editor({content:'',injectCSS:false,extensions:[StarterKit,Markdown],onUpdate(event){ editor.markCurrentSegmentEdited();editor.updateHeadings(event);app.markEdited(); }});
editor.setEditor(instance);app.loading=false;app.isSave=true;app.sidebar.visible=true;app.sidebar.active='search';
window.__searchTest={
 translate(key){return i18n.global.t(key);},
 async fixture(markdown){search.clear();app.setFilepath(null);await editor.setContent(markdown);await editor.setSourceMode('wysiwyg');app.isSave=true;await nextTick();},
 async segmented(){const value=Array.from({length:90},(_,i)=>'## Part '+i+'\n\n'+'ordinary text '.repeat(650)+'\n\n'+(i===0||i===89?'needle <b>\n\n':'')).join('');await this.fixture(value);return value.length;},
 async folder(value){app.folder=value;await nextTick();}, async dirty(){app.markEdited();await nextTick();},
 async open(scope){search.open(scope);await nextTick();}, async locale(value){i18n.global.locale.value=value;await nextTick();},
 async theme(type){app.theme=findThemeByType(type);setTheme(app.theme);await nextTick();},
 async undo(){const result=editor.undoSource();await nextTick();return result;},
 async blocked(value){editor.sourceComposing=value==='ime';editor.sourceEditable=value!=='readonly';comparison.visible=value==='comparison';await nextTick();},
 async attemptReplace(){return search.previewReplacement(true);},async attemptLocate(){return search.locate(0);},
 snapshot(){return {query:search.query,results:search.results,searching:search.searching,stale:search.stale,error:search.errorKey,cancelled:search.cancelled,
  truncated:search.truncated,completed:search.completed,preview:search.replacementPreview?.ranges.length,source:editor.sourceMode,selection:editor.sourceSelection,
  markdown:editor.getMarkdown(),segments:editor.segmentCount,revision:app.editRevision,filepath:app.filepath,isSave:app.isSave};},
};
</script>
<style>html,body{margin:0;height:100%;overflow:hidden}.test-search-layout{display:flex;height:100vh}.test-search-layout>main{flex:1;min-width:90px;overflow:auto;background:var(--contentBackgroundColor);color:var(--contentTextColor)}.tiptap{padding:20px}</style>`;
function nativeMock(){
 window.os='windows';window.isTauri=true;localStorage.setItem('lang','en');localStorage.setItem('sidebarWidth','320');
 const callbacks=new Map(),listeners=new Map();let next=1;
 const text='😀\nfirst needle <b>\nlast needle';
 const state={calls:[],workspaceFailure:false,nextFailure:false,delayNext:false,releaseNext:null,version:'a'.repeat(64),render:()=>'',sessions:new Map(),
  results:[{path:'C:\\notes\\one.md',relativePath:'one.md',from:9,to:15,line:2,column:7,before:'first ',matched:'needle',after:' <b>'},
   {path:'C:\\notes\\nested\\two.markdown',relativePath:'nested\\two.markdown',from:9,to:15,line:2,column:7,before:'first ',matched:'needle',after:' <b>'}],
  versionObject(){return {exists:true,mtimeNs:'1',size:new TextEncoder().encode(text).length,hash:this.version};},
  page(id,final){return {searchId:id,root:'C:\\notes',results:[{...this.results[final?1:0],version:this.versionObject()}],scannedFiles:final?12:8,scannedEntries:final?20:9,
   skippedFiles:final?4:0,skipReasons:{large:1,unreadable:1,links:1,depth:1,changed:0},done:final,cancelled:false,truncated:false};},
 };
 window.__searchNative=state;window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(event,id){listeners.delete(id);}};
 window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},convertFileSrc(value){return value;},
  transformCallback(callback,once=false){const id=next++;callbacks.set(id,value=>{if(once)callbacks.delete(id);return callback(value);});return id;},unregisterCallback(id){callbacks.delete(id);},
  async invoke(command,args={}){
   state.calls.push({command,args});
   if(command==='plugin:event|listen'){const id=next++;listeners.set(id,{event:args.event,handler:args.handler});return id;}
   if(command==='plugin:event|unlisten'){listeners.delete(args.eventId);return;}
   if(command==='get_config')return {code:0,data:{}};
   if(command==='render_markdown')return state.render(args.markdown);
   if(command==='ls_md')return {code:0,data:{children:[]}};
   if(command==='read_md')return {code:0,data:text,version:state.versionObject(),canonicalPath:args.path};
   if(command==='plugin:dialog|message')return args.buttons?.cancel || 'Cancel';
   if(command==='workspace_search_start'){if(state.workspaceFailure)throw new Error('Injected scanner failure');state.sessions.set(args.searchId,true);return state.page(args.searchId,false);}
   if(command==='workspace_search_next'){if(state.delayNext){state.delayNext=false;await new Promise(resolve=>state.releaseNext=resolve);}if(state.nextFailure)throw new Error('Injected page failure');return state.page(args.searchId,true);}
   if(command==='workspace_search_cancel'){state.sessions.delete(args.searchId);return;}
   if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|')||command.startsWith('plugin:event|')||command==='log_error'||command==='log_info')return;
   throw new Error('Unexpected native command '+command);
  }};
}
async function main(){
 const {chromium}=playwright(),{build,preview}=await import('vite'),vue=(await import('@vitejs/plugin-vue')).default;
 const temporary=fs.mkdtempSync(path.join(root,'.document-search-browser-test-'));let server,browser;
 const errors=[];
 try{
  fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
  fs.writeFileSync(path.join(temporary,'main.js'),["import {createApp} from 'vue';","import {createPinia} from 'pinia';","import i18n from '/src/i18n';","import '/src/scss/element-plus.scss';","import 'element-plus/theme-chalk/dark/css-vars.css';","import '/src/styles.css';","import loading from '/src/directives/loading';","import '/src/directives/loading/index.scss';","import Harness from './Harness.vue';","createApp(Harness).directive('loading',loading).use(createPinia()).use(i18n).mount('#app');"].join('\n'));
  fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:"></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
  const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0,strictPort:false}};
  console.log('Building document/workspace search browser harness');await build(config);server=await preview(config);
  const executablePath=process.env.MARKNOTE_BROWSER_PATH||[chromium.executablePath(),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(value=>fs.existsSync(value));
  browser=await chromium.launch({headless:true,executablePath});const page=await browser.newPage({viewport:{width:1000,height:800},reducedMotion:'reduce'});
  page.setDefaultTimeout(15000);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});await page.addInitScript(nativeMock);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);await page.waitForFunction(()=>Boolean(window.__searchTest));
  const api=(method,arg)=>page.evaluate(({method,arg})=>window.__searchTest[method](arg),{method,arg}),label=key=>api('translate',key);
  const input=()=>page.locator('#document-search-query'),results=()=>page.locator('.document-search-result');
  const complete=()=>page.waitForFunction(()=>window.__searchTest.snapshot().completed&&!window.__searchTest.snapshot().searching);
  const query=async value=>{await input().fill(value);await complete();};
  if(process.env.MARKNOTE_SEARCH_VISUAL_ONLY) {
   await api('fixture','needle <b>\nAnother needle.');await query('needle');const outputs=path.join(root,'outputs');fs.mkdirSync(outputs,{recursive:true});
   await api('locale','zhCn');await api('theme','dark');await page.setViewportSize({width:390,height:700});await page.screenshot({path:path.join(outputs,'document-search-chinese-dark.png')});
   await api('locale','en');await api('theme','light');await page.setViewportSize({width:1000,height:800});await page.screenshot({path:path.join(outputs,'document-search-english-light.png')});
   const control=page.getByRole('combobox',{name:await label('searchScope'),exact:true});await control.click();const trigger=await control.locator('xpath=ancestor::*[contains(@class,"el-input")][1]').boundingBox();const popup=await page.locator('.el-select-dropdown:visible').boundingBox();
   assert.ok(Math.abs(trigger.width-popup.width)<=1);await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));await page.screenshot({path:path.join(outputs,'document-search-scope-popup.png')});
   assert.deepEqual(errors,[]);console.log('PASS Search screenshots: authored themed ElSelect, popup width matches trigger and narrow Chinese/dark + English/light');return;
  }
  await api('fixture','😀\nfirst needle <b>\nlast NEEDLE');await query('needle');
  assert.equal(await results().count(),2);assert.equal((await api('snapshot')).results[0].from,9);
  await page.getByRole('checkbox',{name:await label('searchMatchCase'),exact:true}).check();await complete();assert.equal(await results().count(),1);
  await page.getByRole('checkbox',{name:await label('searchMatchCase'),exact:true}).uncheck();await complete();
  await query('<b>');assert.equal(await page.locator('.document-search-snippet b').count(),0);assert.match(await results().first().textContent(),/<b>/);
  await page.getByRole('button',{name:await label('clearSearch'),exact:true}).click();assert.equal(await input().inputValue(),'');assert.equal(await results().count(),0);assert.equal(await input().evaluate(node=>document.activeElement===node),true);
  console.log('PASS Literal search uses original UTF16 positions, case options, escaped HTML snippets and explicit Clear with preserved focus');

  await input().dispatchEvent('compositionstart');await input().fill('needle');await page.waitForTimeout(450);
  assert.equal((await api('snapshot')).results.length,0);await input().dispatchEvent('keydown',{key:'Enter',keyCode:229,isComposing:true});assert.equal((await api('snapshot')).source,'wysiwyg');
  await input().dispatchEvent('compositionend');await complete();await input().press('Enter');await page.waitForFunction(()=>window.__searchTest.snapshot().source==='source');
  const positioned=await api('snapshot');assert.deepEqual(positioned.selection,{from:9,to:15,direction:'forward'});
  console.log('PASS IME waits for composition end; keyboard result activation enters the real source editor at an exact range');
  for(const blocked of ['ime','readonly','comparison']) {
   await api('blocked',blocked);assert.equal(await results().first().isDisabled(),true);assert.equal(await api('attemptReplace'),false);assert.equal(await api('attemptLocate'),false);
  }
  await api('blocked','');console.log('PASS Source composition, read-only mode and an open comparison prevent result navigation and replacement');

  await api('segmented');assert.ok((await api('snapshot')).segments>1);await query('needle');assert.equal(await results().count(),2);
  await results().last().click();assert.ok((await api('snapshot')).selection.from>500000,'Last-segment hit must use whole-document offsets');
  const original=(await api('snapshot')).markdown;
  await page.locator('#document-search-replacement').fill('selected-only');await page.getByRole('button',{name:await label('searchReplaceOne'),exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal((await api('snapshot')).preview,1);
  await dialog.getByRole('button',{name:await label('searchConfirmReplace'),exact:true}).click();
  await page.waitForFunction(()=>window.__searchTest.snapshot().markdown.includes('selected-only'));
  assert.equal((await api('snapshot')).markdown.split('needle').length-1,1);assert.equal(await api('undo'),true);assert.equal((await api('snapshot')).markdown,original);
  await dialog.waitFor({state:'hidden'});if((await api('snapshot')).stale)await page.getByRole('button',{name:await label('searchRefresh'),exact:true}).click();else await input().press('Enter');await complete();
  await page.locator('#document-search-replacement').fill('$&<i>');await page.getByRole('button',{name:await label('searchReplaceAll'),exact:true}).click();
  await dialog.waitFor();assert.equal((await api('snapshot')).preview,2);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal((await api('snapshot')).markdown,original);assert.equal(await input().evaluate(node=>document.activeElement===node),true);
  await page.getByRole('button',{name:await label('searchReplaceAll'),exact:true}).click();await dialog.getByRole('button',{name:await label('searchConfirmReplace'),exact:true}).click();
  await page.waitForFunction(()=>window.__searchTest.snapshot().markdown.includes('$&<i>'));assert.equal((await api('snapshot')).markdown.split('$&<i>').length-1,2);
  assert.equal(await api('undo'),true);assert.equal((await api('snapshot')).markdown,original);
  console.log('PASS All large-file segments are searched; replacement preview can cancel, and confirmed literal replacements share one real source undo');

  await api('fixture','needle '.repeat(305));await query('needle');assert.equal(await results().count(),300);assert.equal((await api('snapshot')).truncated,true);
  await page.getByRole('button',{name:await label('searchReplaceAll'),exact:true}).click();await dialog.waitFor();assert.equal((await api('snapshot')).preview,305,'All replacement must include matches beyond the display cap');
  await dialog.getByRole('button',{name:await label('cancel'),exact:true}).click();await dialog.waitFor({state:'hidden'});
  await api('fixture','needle '.repeat(10001));await query('needle');await page.getByRole('button',{name:await label('searchReplaceAll'),exact:true}).click();await page.getByText(await label('searchReplaceLimit'),{exact:true}).waitFor();
  assert.equal((await api('snapshot')).markdown,'needle '.repeat(10001));
  await api('fixture','needle '.repeat(2200));await query('needle');await page.locator('#document-search-replacement').fill('x'.repeat(2048));await page.getByRole('button',{name:await label('searchReplaceAll'),exact:true}).click();
  await page.getByText(await label('sourceChangeTooLarge'),{exact:true}).waitFor();assert.equal((await api('snapshot')).markdown,'needle '.repeat(2200));assert.equal((await api('snapshot')).preview,undefined);
  console.log('PASS Display caps retain a partial-state warning; all replacement scans every match and rejects oversized transactions without touching source');

  await api('fixture','needle');await query('needle');await api('dirty');await page.getByText(await label('searchStale'),{exact:true}).waitFor();assert.equal(await results().first().isDisabled(),true);
  await page.getByRole('button',{name:await label('searchRefresh'),exact:true}).click();await complete();assert.equal((await api('snapshot')).stale,false);
  await query('missing');await page.getByText(await label('searchNoMatches'),{exact:true}).waitFor();
  await api('open','workspace');await input().fill('needle');await page.getByText(await label('searchNoWorkspace'),{exact:true}).waitFor();
  await api('folder','C:\\notes');await page.evaluate(()=>window.__searchNative.workspaceFailure=true);await page.getByRole('button',{name:await label('retry'),exact:true}).click();
  await page.getByText(await label('searchWorkspaceFailed'),{exact:true}).waitFor();await page.evaluate(()=>window.__searchNative.workspaceFailure=false);await page.getByRole('button',{name:await label('retry'),exact:true}).click();await complete();
  assert.equal(await results().count(),2);assert.match(await page.locator('.document-search-progress').textContent(),/12/);assert.match(await results().last().textContent(),/two.markdown/);
  console.log('PASS Changed documents block stale results; no-match/no-workspace/native errors have distinct recoverable states and paged workspace results report skips');

  await page.evaluate(()=>window.__searchNative.delayNext=true);await input().fill('NEEDLE');await page.waitForFunction(()=>Boolean(window.__searchNative.releaseNext));
  await page.getByRole('button',{name:await label('searchCancel'),exact:true}).click();assert.equal((await api('snapshot')).cancelled,true);
  await page.evaluate(()=>window.__searchNative.releaseNext());await page.waitForTimeout(50);assert.equal((await api('snapshot')).results.length,1);
  await page.getByRole('button',{name:await label('clearSearch'),exact:true}).click();assert.equal((await api('snapshot')).results.length,0);
  await query('needle');const before=(await api('snapshot')).markdown;
  const guardCalls=await page.evaluate(()=>window.__searchNative.calls.filter(call=>call.command==='plugin:dialog|message').length);
  await results().first().click();
  // Simulate cancellation of the canonical native unsaved dialog, not a competing UI guard.
  await page.waitForFunction(count=>window.__searchNative.calls.filter(call=>call.command==='plugin:dialog|message').length>count,guardCalls);
  await page.waitForFunction(()=>!window.__searchTest.snapshot().filepath);assert.equal((await api('snapshot')).markdown,before);
  await api('fixture','safe current');await api('open','workspace');await query('needle');await page.evaluate(()=>window.__searchNative.version='b'.repeat(64));await results().first().click();
  await page.getByText(await label('searchStale'),{exact:true}).waitFor();assert.equal((await api('snapshot')).source,'wysiwyg');
  console.log('PASS Cancellation ignores an in-flight page and keeps partial results; opening changed workspace files refuses stale source offsets');

  await api('fixture','needle');await api('open','document');await api('locale','zhCn');await api('theme','dark');await page.setViewportSize({width:390,height:700});await query('needle');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const outputs=path.join(root,'outputs');fs.mkdirSync(outputs,{recursive:true});await page.screenshot({path:path.join(outputs,'document-search-chinese-dark.png')});
  await api('locale','en');await api('theme','light');await page.setViewportSize({width:1000,height:800});await page.screenshot({path:path.join(outputs,'document-search-english-light.png')});
  assert.deepEqual(errors,[]);console.log('Document/workspace search browser checks passed');
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));const resolved=path.resolve(temporary);if(path.dirname(resolved)===root&&path.basename(resolved).startsWith('.document-search-browser-test-'))fs.rmSync(resolved,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
