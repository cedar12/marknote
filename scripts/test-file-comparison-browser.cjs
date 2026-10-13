/* Real comparison dialog, editor/source stores and Tiptap; read_md alone is mocked. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function playwright(){for(const name of [process.env.MARKNOTE_PLAYWRIGHT_PATH,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{return require(name);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}throw Error('Playwright is required.');}
function browserOptions(chromium){if(process.env.MARKNOTE_BROWSER_PATH)return {executablePath:process.env.MARKNOTE_BROWSER_PATH};if(fs.existsSync(chromium.executablePath()))return {};const executablePath=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);if(!executablePath)throw Error('Chromium is required.');return {executablePath};}
const harness=String.raw`<template>
<main :inert="comparison.visible"><button data-review @click="comparison.open()">{{ t('fileComparisonReview') }}</button>
<EditorContent v-show="document.sourceMode === 'wysiwyg'" :editor="instance"/><SourceWorkspace v-show="document.sourceMode !== 'wysiwyg'"/></main>
<FileComparisonDialog/>
</template><script setup>
import {nextTick,onBeforeUnmount} from 'vue';import {useI18n} from 'vue-i18n';
import {Editor,EditorContent} from '@tiptap/vue-3';import StarterKit from '@tiptap/starter-kit';
import {Markdown} from '/src/extensions/markdown';import {useAppStore} from '/src/store/app';
import {useEditorStore} from '/src/store/editor';import {useFileComparisonStore} from '/src/store/fileComparison';
import FileComparisonDialog from '/src/components/dialog/FileComparisonDialog.vue';import SourceWorkspace from '/src/components/source/SourceWorkspace.vue';
const {t,locale}=useI18n();const app=useAppStore(),document=useEditorStore(),comparison=useFileComparisonStore();
app.loading=false;app.isSave=true;
const instance=new Editor({injectCSS:false,content:'',extensions:[StarterKit,Markdown.configure({html:true})],onUpdate(){document.markCurrentSegmentEdited();app.markEdited();}});
document.setEditor(instance);let stateBefore;
window.__comparisonTest={
 async setup({local,disk}){comparison.close();window.__comparisonNative.failure=false;window.__comparisonNative.delay=0;document.sourceComposing=false;
 await document.setContent(local);app.filepath='C:\\notes\\shared.md';app.fileCanonicalPath=app.filepath;app.fileVersion=await window.__comparisonNative.version('saved');
 await this.external(disk);app.isSave=false;app.markEdited();await nextTick();stateBefore=instance.state;},
 async external(disk){window.__comparisonNative.disk=disk;app.fileConflict={path:app.filepath,canonicalPath:app.fileCanonicalPath,version:await window.__comparisonNative.version(disk),detectedAt:Date.now()};},
 open(){return comparison.open();},refresh(){return comparison.refresh();},close(){comparison.close();},
 async source(){return document.setSourceMode('source');},
 async sourceEdit(text){const changed=document.updateSource(text,{from:0,to:0,direction:'none'});await nextTick();return changed;},
 async mode(value){return document.setSourceMode(value);},
 async edit(text){instance.commands.insertContent(text);await nextTick();},
 native(options){Object.assign(window.__comparisonNative,options);},
 composing(value){document.sourceComposing=value;},
 locale(value){locale.value=value;},
 snapshot(){return {visible:comparison.visible,pending:comparison.pending,stale:comparison.stale,error:comparison.errorKey,result:comparison.result,
 baseline:app.fileVersion,revision:app.editRevision,render:document.renderVersion,filepath:app.filepath,markdown:document.getMarkdown(),statePreserved:instance.state===stateBefore,
 sourceMode:document.sourceMode,sourceText:document.sourceText,json:instance.getJSON(),selection:{from:instance.state.selection.from,to:instance.state.selection.to},calls:window.__comparisonNative.calls};}
};
onBeforeUnmount(()=>{comparison.close();document.setEditor(undefined);instance.destroy();});
</script><style>body{margin:0}main{padding:24px;font:14px sans-serif}.tiptap{min-height:160px}.source-workspace{height:400px}</style>`;
function nativeMock(){
  window.os='windows';window.isTauri=false;const state={disk:'disk',failure:false,delay:0,calls:[]};window.__comparisonNative=state;
  state.version=async text=>{const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);return {exists:true,mtimeNs:'1',size:bytes.length,hash:Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')};};
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'window_1'},currentWebview:{label:'window_1'}},convertFileSrc:value=>value,transformCallback:()=>1,unregisterCallback(){},async invoke(command,args={}){
    state.calls.push({command,args});if(command==='get_config')return {code:0,data:{}};
    if(command==='read_md'){const disk=state.disk,failure=state.failure,delay=state.delay;if(delay)await new Promise(resolve=>setTimeout(resolve,delay));if(failure)return {code:1,info:'Injected unreadable file'};
      return {code:0,info:args.path,data:disk,version:await state.version(disk),canonicalPath:'C:\\notes\\shared.md'};}
    if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|'))return;
    throw Error('Unexpected native command '+command);
  }};
}
async function main(){
  const {chromium}=playwright(),{build,preview}=await import('vite'),vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.file-comparison-browser-test-'));let server,browser;const errors=[];
  try{
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';import {createPinia} from 'pinia';import i18n from '/src/i18n';import 'element-plus/dist/index.css';import '/src/styles.css';import Harness from './Harness.vue';createApp(Harness).use(createPinia()).use(i18n).mount('#app');");
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:"></head><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0,strictPort:false}};
    console.log('Building file comparison browser harness');await build(config);server=await preview(config);
    browser=await chromium.launch({headless:true,...browserOptions(chromium)});const context=await browser.newContext({viewport:{width:1100,height:800}});await context.addInitScript(nativeMock);
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);await page.waitForFunction(()=>!!window.__comparisonTest);
    const api=(method,arg)=>page.evaluate(({method,arg})=>window.__comparisonTest[method](arg),{method,arg});
    const dialog=page.locator('.file-comparison-dialog');
    const settled=()=>page.waitForFunction(()=>!document.querySelector('.dialog-fade-enter-active,.dialog-fade-leave-active')
      &&document.activeElement?.tagName==='BUTTON'&&(/Close and continue|关闭，继续/.test(document.activeElement.textContent||'')));
    await api('locale','en');await api('setup',{local:'# Local\n\nA local paragraph\n',disk:'# Local\n\nA disk paragraph\n<img src=x onerror="window.__comparisonPayload=true">\n<script>window.__comparisonPayload=true</script>\n'});
    const before=await api('snapshot');assert.equal(await api('open'),true);await dialog.waitFor({state:'visible'});await settled();
    let state=await api('snapshot');assert.equal(state.statePreserved,true);assert.deepEqual(state.json,before.json);assert.deepEqual(state.baseline,before.baseline);assert.equal(state.revision,before.revision);
    assert.equal(await dialog.locator('img,script').count(),0);assert.equal(await page.evaluate(()=>!!window.__comparisonPayload),false);assert.ok((await dialog.innerText()).includes('<img src=x'));
    assert.ok(await dialog.locator('.diff-remove').count());assert.ok(await dialog.locator('.diff-add').count());assert.equal(await dialog.getByRole('button',{name:'Refresh differences',exact:true}).isEnabled(),true);
    fs.mkdirSync(path.join(root,'outputs'),{recursive:true});await page.screenshot({path:path.join(root,'outputs','file-comparison-english.png')});
    console.log('PASS escaped line differences preserve document, history identity, revision and saved baseline');
    await api('external','# Newer disk\n');assert.equal((await api('snapshot')).stale,true);assert.ok((await dialog.innerText()).includes('Refresh the comparison'));
    await dialog.getByRole('button',{name:'Refresh differences',exact:true}).click();await page.waitForFunction(()=>!window.__comparisonTest.snapshot().pending);assert.equal((await api('snapshot')).stale,false);
    await api('native',{failure:true});await dialog.getByRole('button',{name:'Refresh differences',exact:true}).click();await page.waitForFunction(()=>!!window.__comparisonTest.snapshot().error);
    assert.ok((await dialog.innerText()).includes('Your document is preserved'));await api('native',{failure:false});await dialog.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForFunction(()=>!window.__comparisonTest.snapshot().pending);assert.equal((await api('snapshot')).error,null);
    console.log('PASS disk updates mark the comparison stale; failed refresh retains its view and Retry recovers');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__comparisonTest.snapshot().visible);
    await api('native',{delay:800});const pending=api('open');await page.waitForFunction(()=>window.__comparisonTest.snapshot().pending);await dialog.waitFor({state:'visible'});
    assert.equal(await dialog.getByRole('button',{name:'Refresh differences',exact:true}).isEnabled(),false);await page.keyboard.press('Escape');assert.equal(await pending,false);
    state=await api('snapshot');assert.equal(state.visible,false);assert.equal(state.result,null);assert.equal(state.pending,false);await api('native',{delay:0});
    console.log('PASS Escape cancels pending reads and late responses cannot reopen or repopulate the dialog');
    await api('setup',{local:'# Source\n\nUntouched exact  spacing\n',disk:'# Source\n\nDisk version\n'});assert.equal(await api('source'),true);
    const full='# Source\n\nTyped source content\n\n[ref]: target.md\n\nLast document section\n';assert.equal(await api('sourceEdit',full),true);
    const sourceBefore=await api('snapshot');assert.equal(await api('open'),true);state=await api('snapshot');assert.equal(state.markdown,full);assert.equal(state.sourceMode,'source');assert.deepEqual(state.baseline,sourceBefore.baseline);assert.ok((await dialog.innerText()).includes('Last document section'));
    await api('sourceEdit',full+'More source\n');assert.equal((await api('snapshot')).stale,true);await api('refresh');
    await dialog.getByRole('button',{name:'Close and continue editing',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-source-editor'));
    assert.equal((await api('snapshot')).sourceText,full+'More source\n');
    await api('composing',true);const reads=(await api('snapshot')).calls.length;assert.equal(await api('open'),false);assert.equal((await api('snapshot')).error,'fileComparisonBusy');assert.equal((await api('snapshot')).calls.length,reads);await api('close');await api('composing',false);
    console.log('PASS full source buffer is compared without mode changes; editing invalidates the snapshot and close restores source focus');
    await api('setup',{local:'old '+ 'x'.repeat(20000),disk:'new '+ 'y'.repeat(20000)});await api('locale','zhCn');assert.equal(await api('open'),true);await page.setViewportSize({width:390,height:700});
    await dialog.waitFor({state:'visible'});await settled();state=await api('snapshot');assert.ok(state.result.shortenedLines);assert.ok((await dialog.innerText()).includes('单行已截短'));
    assert.equal(await dialog.getByRole('button',{name:'刷新差异',exact:true}).isEnabled(),true);
    assert.ok(await dialog.locator('tbody tr').count()<=400);const box=await dialog.boundingBox();assert.ok(box.width<=390&&box.x>=0&&box.y>=0);
    await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--contentBackgroundColor','#282828');document.documentElement.style.setProperty('--contentTextColor','#cbcbcb');document.documentElement.style.setProperty('--contentBorderColor','#777');document.documentElement.style.setProperty('--contentBackgroundColorActive','#343434');});
    // Element Plus buttons transition theme colors; wait for the actual final
    // foreground/background rather than capturing a low-contrast middle frame.
    await page.waitForFunction(()=>{
      const button=Array.from(document.querySelectorAll('.file-comparison-dialog button')).find(element=>element.textContent==='刷新差异');
      return button&&getComputedStyle(button).backgroundColor==='rgb(40, 40, 40)'&&getComputedStyle(button).color==='rgb(203, 203, 203)';
    },null,{timeout:5000});
    await page.screenshot({path:path.join(root,'outputs','file-comparison-chinese-dark-narrow.png')});
    await dialog.getByRole('button',{name:'关闭，继续编辑',exact:true}).click();await page.waitForFunction(()=>!window.__comparisonTest.snapshot().visible);
    console.log('PASS Chinese narrow/dark layout keeps shortened lines, visible numbers, close and refresh controls');
    assert.deepEqual(errors,[]);console.log('File comparison browser checks passed');
  }finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));const absolute=path.resolve(temporary);if(path.dirname(absolute)===root&&path.basename(absolute).startsWith('.file-comparison-browser-test-'))fs.rmSync(absolute,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
