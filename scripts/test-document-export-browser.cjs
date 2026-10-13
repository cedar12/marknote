/* Real HTML renderer and export-store checks; only native IPC is simulated. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required. Set MARKNOTE_PLAYWRIGHT_PATH.');
}

const harness = `<template><div id="live-editor"><EditorContent :editor="editor" /></div></template>
<script setup>
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '/src/extensions/markdown';
import { useAppStore } from '/src/store/app';
import { useEditorStore } from '/src/store/editor';
import { useDocumentExportStore } from '/src/store/documentExport';
import { renderDocumentHTML } from '/src/utils/documentExport';
const app = useAppStore(), documentStore = useEditorStore(), exports = useDocumentExportStore();
const editor = new Editor({ extensions:[StarterKit, TaskList, TaskItem, Markdown.configure({html:true})], content:'Live document stays unchanged', injectCSS:false });
documentStore.setEditor(editor); app.loading=false; app.isSave=false;
window.__exports = {
  async setup(markdown) { await documentStore.setContent(markdown); editor.commands.setTextSelection(2); app.filepath=null; app.isSave=false; },
  run(format) { return exports.exportDocument(format); },
  render(markdown, options={}) { return renderDocumentHTML(editor, markdown, null, options); },
  busy(value) { app.lifecycleBusy=value; },
  snapshot() { return {markdown:documentStore.getMarkdown(),json:editor.getJSON(),selection:editor.state.selection.from,segment:documentStore.segmentIndex,segmented:documentStore.segmented,exporting:app.exporting,pending:exports.pending,error:exports.error,temporary:document.querySelectorAll('.image-export-document').length}; },
};
</script>`;

function nativeMock() {
  window.os='windows'; window.isTauri=true;
  const state={pick:'D:\\notes\\export.html',calls:[],response:{code:0},error:false,dialogs:[],delay:false,release:null};
  window.__native=state;
  let id=1;
  window.__TAURI_INTERNALS__={
    metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
    transformCallback(){return id++;}, unregisterCallback(){}, convertFileSrc(value){return value;},
    async invoke(command,args={}) {
      state.calls.push({command,args});
      if(command==='plugin:dialog|save') { if(state.delay){state.delay=false;await new Promise(resolve=>state.release=resolve);} return state.pick; }
      if(command==='plugin:dialog|message'){state.dialogs.push(args);return;}
      if(command==='export_html'||command==='export_pdf') {if(state.error)throw new Error('Injected write failure');return state.response;}
      if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|')||command.startsWith('plugin:notification|'))return;
      if(command==='render_markdown')throw new Error('Use browser parser');
      throw new Error('Unexpected command: '+command);
    },
  };
  window.Notification=class{};
}

async function main() {
  const {chromium}=loadPlaywright();
  const {build,preview}=await import('vite');
  const vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.document-export-test-'));
  let server,browser;
  try {
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';import {createPinia} from 'pinia';import '/src/styles.css';import '/src/scss/editor.scss';import '/src/scss/codeTheme.scss';import i18n from '/src/i18n';import Harness from './Harness.vue';createApp(Harness).use(createPinia()).use(i18n).mount('#root');");
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module" src="./main.js"></script></body></html>');
    const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0}};
    await build(config);server=await preview(config);
    const executablePath=process.env.MARKNOTE_BROWSER_PATH || (fs.existsSync(chromium.executablePath())?undefined:['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync));
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const page=await browser.newPage({viewport:{width:1050,height:700}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/fixture.svg', route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>'}));
    await page.addInitScript(nativeMock);
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);
    await page.waitForFunction(()=>window.__exports);
    const setup=markdown=>page.evaluate(markdown=>window.__exports.setup(markdown),markdown);
    const snapshot=()=>page.evaluate(()=>window.__exports.snapshot());
    const run=format=>page.evaluate(format=>window.__exports.run(format),format);
    const call=format=>page.evaluate(format=>window.__native.calls.filter(call=>call.command==='export_'+format).at(-1),format);
    const unchanged=(before,after)=>{for(const field of ['markdown','json','selection','segment'])assert.deepEqual(after[field],before[field]);assert(!after.exporting&&!after.pending);assert.equal(after.temporary,0);};

    await setup('# Unsaved new document\n\nTail text');
    let before=await snapshot();assert.equal(await run('html'),true);
    let written=await call('html');assert(written.args.html.startsWith('<!doctype html>'));assert(written.args.html.includes('Tail text'));unchanged(before,await snapshot());
    console.log('PASS unsaved new document exports with live state preserved');

    const markdown='# First segment\n\n'+('A paragraph containing enough text to exercise full document segmentation.\n\n'.repeat(8500))+'# Final segment\n\nFinal document marker.';
    await setup(markdown);before=await snapshot();assert(before.segmented);assert.equal(await run('html'),true);
    written=await call('html');assert(written.args.html.includes('First segment'));assert(written.args.html.includes('Final segment'));assert(written.args.html.includes('Final document marker.'));unchanged(before,await snapshot());
    await page.evaluate(()=>window.__native.pick='D:\\notes\\export.pdf');assert.equal(await run('pdf'),true);
    written=await call('pdf');assert(written.args.html.includes('Final document marker.'));assert(written.args.html.includes('@page'));unchanged(before,await snapshot());
    console.log('PASS HTML and PDF use the entire segmented document');

    const output=await page.evaluate(()=>window.__exports.render('# Math\n\nInline $x^2$ and block:\n\n$$\n\\frac{1}{2}\n$$\n\n```mermaid\nflowchart LR\nA-->B\n```\n\n<img src="/fixture.svg" onerror="alert(1)"><script>alert(1)</script>',{title:'<unsafe title>',locale:'zhCn'}));
    assert(output.includes('<math'));assert(!output.includes('class="katex-html"'));assert(output.includes('image-export-diagram'));assert(output.includes('data:image/svg+xml'));assert(output.includes('lang="zh-CN"'));assert(output.includes('&lt;unsafe title&gt;'));assert(!output.includes('onerror=')&&!output.includes('<script>'));assert(!output.includes('src="/fixture.svg"'));assert.equal((await snapshot()).temporary,0);
    const offline=await browser.newPage();await offline.setContent(output);assert.equal(await offline.locator('math').count(),2);assert.equal(await offline.locator('img').count(),2);
    const paginated=await page.evaluate(()=>window.__exports.render(Array.from({length:105},(_,index)=>'<div style="break-before:page">Printed page '+index+'</div>').join('\n\n'),{print:true}));
    await offline.setContent(paginated);
    const pdf=await offline.pdf({preferCSSPageSize:true,printBackground:true});
    const pageCount=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
    assert(pageCount>100,'standalone print document retains pages beyond 100');await offline.close();
    console.log('PASS self-contained images, Mermaid, native MathML, locale and sanitization');
    console.log('PASS Chromium prints more than 100 pages from the export document');

    await page.evaluate(()=>{window.__native.pick=null;window.__native.calls=[];});assert.equal(await run('html'),false);assert.equal(await call('html'),undefined);unchanged(before,await snapshot());
    await page.evaluate(()=>{window.__native.pick='D:\\notes\\export.html';window.__native.response={code:1,info:'Injected response failure'};});assert.equal(await run('html'),false);assert((await snapshot()).error.includes('Injected response failure'));unchanged(before,await snapshot());
    await page.evaluate(()=>{window.__native.response={code:0};window.__native.error=true;});assert.equal(await run('html'),false);unchanged(before,await snapshot());
    await page.evaluate(()=>{window.__native.error=false;window.__exports.busy(true);window.__native.calls=[];});assert.equal(await run('html'),false);assert.equal(await page.evaluate(()=>window.__native.calls.length),0);await page.evaluate(()=>window.__exports.busy(false));
    console.log('PASS cancellation, response errors, write failures and lifecycle lock');

    await page.evaluate(()=>{window.__native.delay=true;window.__native.calls=[];window.__firstExport=window.__exports.run('html');});
    await page.waitForFunction(()=>window.__native.release);assert((await snapshot()).exporting);assert.equal(await run('pdf'),false);
    await page.evaluate(()=>window.__native.release());assert.equal(await page.evaluate(()=>window.__firstExport),true);assert.equal(await page.evaluate(()=>window.__native.calls.filter(call=>call.command==='plugin:dialog|save').length),1);unchanged(before,await snapshot());
    console.log('PASS export is locked from picker through confirmed write');
    assert.deepEqual(errors,[]);
  } finally {
    await browser?.close();await new Promise(resolve=>server?server.httpServer.close(resolve):resolve());
    if(!temporary.startsWith(root+path.sep))throw new Error('Unsafe temporary path');
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
