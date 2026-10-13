const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function playwright(){for(const location of [process.env.MARKNOTE_PLAYWRIGHT_PATH,'playwright',path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{return require(location);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}throw new Error('Playwright is required');}
const harness=String.raw`<template><main><EditorContent :editor="editor" /></main></template>
<script setup>
import {Editor,EditorContent} from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import {nextTick} from 'vue';
import {Image} from '/src/extensions/image';
import {Markdown} from '/src/extensions/markdown';
import {useAppStore} from '/src/store/app';
import {useEditorStore} from '/src/store/editor';
const app=useAppStore(), store=useEditorStore();app.loading=false;
const editor=new Editor({content:'',extensions:[StarterKit,Image.configure({inline:true}),Markdown],onUpdate(){store.markCurrentSegmentEdited();app.markEdited();}});
store.setEditor(editor);
window.__images={
 async fixture(){app.setFilepath(null);await store.setContent('before after');editor.commands.setTextSelection(8);await nextTick();},
 paste(){const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array([1,2,3])],'image.png',{type:'image/png'}));editor.view.dom.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));},
 edit(){editor.view.dispatch(editor.state.tr.insertText('prefix ',1));},
 async switchDocument(){await store.setContent('another document');},
 async mapping(mapping){store.setAttachmentMapping(mapping);await nextTick();},
 undo(){return editor.commands.undo();},
 saving(value){app.saving=value;},
 snapshot(){return {markdown:store.getMarkdown(),tasks:app.resourceTasks,nodes:editor.getJSON(),selection:editor.state.selection.from,mapping:{...store.attachmentMapping}};}
};
</script><style>main{padding:20px}.tiptap{min-height:200px}</style>`;
async function main(){
 const {chromium}=playwright();const {build,preview}=await import('vite');const vue=(await import('@vitejs/plugin-vue')).default;
 const temporary=fs.mkdtempSync(path.join(root,'.image-insertion-test-'));let server,browser;
 try{
  fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
  fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';import {createPinia} from 'pinia';import i18n from '/src/i18n';import Harness from './Harness.vue';i18n.global.locale.value='en';createApp(Harness).use(createPinia()).use(i18n).mount('#test');");
  fs.writeFileSync(path.join(temporary,'index.html'),'<html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="test"></div><script type="module" src="./main.js"></script></body></html>');
  const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0}};
  await build(config);server=await preview(config);
  const executablePath=process.env.MARKNOTE_BROWSER_PATH||[chromium.executablePath(),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
  browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.os='windows';window.isTauri=false;window.__imageIPC={calls:[],resolve:null};
   window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},async invoke(command,args){window.__imageIPC.calls.push({command,args});if(command==='save_image')return new Promise(resolve=>window.__imageIPC.resolve=resolve);if(command.startsWith('plugin:log|'))return;if(command==='plugin:dialog|message'||command==='plugin:window|set_title')return;throw new Error('Unexpected IPC '+command);}};
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);await page.waitForFunction(()=>window.__images);
  const api=(method,arg)=>page.evaluate(({method,arg})=>window.__images[method](arg),{method,arg});
  await api('fixture');await api('paste');await page.waitForFunction(()=>window.__imageIPC.resolve);
  assert.equal((await api('snapshot')).tasks,1);
  assert.equal(await page.evaluate(()=>window.__imageIPC.calls.find(call=>call.command==='save_image').args.mdPath),null,'unnamed documents may persist images');
  await api('edit');await page.evaluate(()=>{window.__imageIPC.resolve({code:0,info:'original-assets/image.png'});window.__imageIPC.resolve=null;});await page.waitForFunction(()=>window.__images.snapshot().tasks===0);
  const pasted=await api('snapshot');assert(pasted.markdown.includes('prefix before ![image.png]'),'insertion follows the mapped original selection after intervening edits: '+pasted.markdown);
  const selection=pasted.selection;await api('mapping',{'original-assets/image.png':'copy.md.assets/image.png'});
  assert((await api('snapshot')).markdown.includes('copy.md.assets/image.png'));assert.equal((await api('snapshot')).selection,selection);
  await api('mapping',{'copy.md.assets/image.png':'third.md.assets/image.png'});assert((await api('snapshot')).markdown.includes('third.md.assets/image.png'),'successive Save As mappings fold aliases');
  assert.equal(await api('undo'),true);assert(!(await api('snapshot')).markdown.includes('!['),'attachment rebasing keeps image insertion undoable');
  console.log('PASS unnamed image insertion, async position mapping, Save As aliases and undo history');
  await api('fixture');await api('paste');await page.waitForFunction(()=>window.__imageIPC.resolve);await api('switchDocument');
  await page.evaluate(()=>{window.__imageIPC.resolve({code:0,info:'stale.png'});window.__imageIPC.resolve=null;});await page.waitForFunction(()=>window.__images.snapshot().tasks===0);
  assert.equal((await api('snapshot')).markdown,'another document');console.log('PASS delayed image upload cannot modify another document');
  await api('fixture');const previousUploads=await page.evaluate(()=>window.__imageIPC.calls.filter(call=>call.command==='save_image').length);await api('saving',true);await api('paste');
  assert.equal((await api('snapshot')).tasks,0);assert.equal(await page.evaluate(()=>window.__imageIPC.calls.filter(call=>call.command==='save_image').length),previousUploads);await api('saving',false);console.log('PASS saving prevents competing image resource jobs');
  await api('fixture');await api('paste');await page.waitForFunction(()=>window.__imageIPC.resolve);await page.evaluate(()=>{window.__imageIPC.resolve({code:1,info:'failed'});window.__imageIPC.resolve=null;});await page.waitForFunction(()=>window.__images.snapshot().tasks===0);
  assert.equal((await api('snapshot')).markdown,'before after');assert(await page.evaluate(()=>window.__imageIPC.calls.some(call=>call.command==='plugin:dialog|message')));assert.deepEqual(errors,[]);console.log('PASS upload failure retains content and releases busy state with feedback');
 }finally{await browser?.close();await new Promise(resolve=>server?server.httpServer.close(resolve):resolve());if(path.dirname(path.resolve(temporary))===root&&path.basename(temporary).startsWith('.image-insertion-test-'))fs.rmSync(temporary,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
