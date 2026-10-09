/* Real canvas regression checks. Requires Playwright or MARKNOTE_PLAYWRIGHT_PATH. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required; set MARKNOTE_PLAYWRIGHT_PATH.');
}

const harness = `<template><main id="live-editor"><EditorContent :editor="editor" /></main></template>
<script setup>
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Markdown } from '/src/extensions/markdown';
import { renderDocumentImage } from '/src/utils/imageExport';
import { DEFAULT_IMAGE_EXPORT_OPTIONS } from '/src/utils/imageExportOptions';
const editor = new Editor({ content:'<p>Live editor stays unchanged</p>', injectCSS:false,
  extensions:[StarterKit, TaskItem, TaskList, Markdown.configure({html:true,breaks:true})] });
window.__capture = async (markdown, options = {}) => {
  const live = document.querySelector('#live-editor');
  live.scrollTop = 20;
  const state = editor.state;
  const before = {html:editor.getHTML(), scroll:live.scrollTop, selection:editor.state.selection.from};
  const originalTauri=window.isTauri,originalInternals=window.__TAURI_INTERNALS__;
  const nativePaths=[];
  if(options.nativeImagePaths){window.isTauri=true;window.__TAURI_INTERNALS__={convertFileSrc(filePath){nativePaths.push(filePath);return 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22red%22/%3E%3C/svg%3E';}};}
  let staged, cloneCount=0, inlineMathDisplay;
  const observer = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof HTMLElement && node.classList.contains('image-export-document')) {
        staged = node;
        const inline=node.querySelector('p .katex-html');
        if(inline)inlineMathDisplay=getComputedStyle(inline).display;
      }
      if (node instanceof HTMLIFrameElement && node.classList.contains('html2canvas-container')) cloneCount++;
    }
  });
  observer.observe(document.body, {childList:true});
  try {
    const blob = await renderDocumentImage(editor, markdown, {...DEFAULT_IMAGE_EXPORT_OPTIONS,...options}, options.sourcePath || null);
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
    const context=canvas.getContext('2d'); context.drawImage(bitmap,0,0);
    const pixel=(x,y)=>Array.from(context.getImageData(Math.min(canvas.width-1,x),Math.min(canvas.height-1,y),1,1).data);
    const colors={red:0,green:0,blue:0,dark:0};
    const pixels=context.getImageData(Math.floor(canvas.width/2),0,1,canvas.height).data;
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i]>230&&pixels[i+1]<30&&pixels[i+2]<30)colors.red++;
      if(pixels[i]<30&&pixels[i+1]>230&&pixels[i+2]<30)colors.green++;
      if(pixels[i]<30&&pixels[i+1]<30&&pixels[i+2]>230)colors.blue++;
      if(pixels[i]<150&&pixels[i+1]<150&&pixels[i+2]<150&&pixels[i+3]>0)colors.dark++;
    }
    let glyphPixels=0;
    const glyphData=context.getImageData(32,32,Math.min(320,bitmap.width-32),Math.max(1,Math.min(240,bitmap.height-32))).data;
    for(let i=0;i<glyphData.length;i+=4)if(glyphData[i]<180&&glyphData[i+1]<180&&glyphData[i+2]<180&&glyphData[i+3]>0)glyphPixels++;
    const result={type:blob.type,size:blob.size,width:bitmap.width,height:bitmap.height,cloneCount,glyphPixels,nativePaths,
      corner:pixel(0,0),center:pixel(Math.floor(bitmap.width/2),Math.floor(bitmap.height/2)),colors,
      stagedHTML:staged?.innerHTML,inlineMathDisplay, clean:!document.querySelector('.image-export-document,iframe.html2canvas-container'),
      unchanged:state===editor.state&&before.html===editor.getHTML()&&before.scroll===live.scrollTop&&before.selection===editor.state.selection.from};
    bitmap.close();canvas.width=0;canvas.height=0;return result;
  }catch(error){return {code:error.code,message:error.message,clean:!document.querySelector('.image-export-document,iframe.html2canvas-container'),unchanged:state===editor.state};}
  finally{observer.disconnect();window.isTauri=originalTauri;window.__TAURI_INTERNALS__=originalInternals;}
};
</script>
<style>html,body{margin:0;}#live-editor{height:50px;overflow:auto;}#live-editor p{margin:0;height:100px;}</style>`;

async function main() {
  const {chromium} = loadPlaywright();
  const {build,preview} = await import('vite');
  const vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.image-capture-test-'));
  let server,browser;
  const passed=[];
  try {
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';\nimport '/src/styles.css';\nimport '/src/scss/editor.scss';\nimport '/src/scss/codeTheme.scss';\nimport Harness from './Harness.vue';\ncreateApp(Harness).mount('#test-root');");
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="test-root"></div><script type="module" src="./main.js"></script></body></html>');
    const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0}};
    console.log('Building image capture browser harness');
    await build(config); server=await preview(config);
    const executablePath=process.env.MARKNOTE_BROWSER_PATH || (fs.existsSync(chromium.executablePath()) ? undefined : ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync));
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const url=`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    const page=await browser.newPage({viewport:{width:1100,height:700},deviceScaleFactor:2});
    page.on('pageerror',error=>console.error('Browser error:',error.message));
    await page.goto(url);await page.waitForFunction(()=>window.__capture);
    const capture=(markdown,options)=>page.evaluate(({markdown,options})=>window.__capture(markdown,options),{markdown,options});
    const record=name=>{passed.push(name);console.log(`PASS ${name}`);};

    let result=await capture('# Complete document\n\nText at the end.',{width:480});
    assert.equal(result.type,'image/png');assert.equal(result.width,480);assert(result.size>0);assert.equal(result.cloneCount,1);assert(result.clean&&result.unchanged);record('PNG uses one capture independent of device DPR; live state and DOM are preserved');
    result=await capture('Text',{width:480,scale:2});assert.equal(result.width,960);record('2x setting produces explicit double resolution');
    result=await capture('Text',{format:'jpeg',background:'white'});assert.equal(result.type,'image/jpeg');assert(result.corner.slice(0,3).every(value=>value>245));record('JPEG bytes match selected format');
    result=await capture('Text',{background:'transparent'});assert.equal(result.corner[3],0);record('Transparent PNG keeps alpha');
    await page.evaluate(()=>{document.documentElement.classList.add('dark');document.documentElement.style.setProperty('--contentBackgroundColor','#282828');document.documentElement.style.setProperty('--contentTextColor','#cbcbcb');});
    result=await capture('Readable',{background:'white'});assert(result.corner.slice(0,3).every(value=>value>245));record('White background overrides dark theme');

    const bands='<div style="background:#ff0000;height:100px"></div>\n\n'+Array.from({length:80},(_,i)=>`Paragraph ${i}.\n\n`).join('')+'<div style="background:#00ff00;height:100px"></div>\n\n'+Array.from({length:80},(_,i)=>`Tail ${i}.\n\n`).join('')+'<div style="background:#0000ff;height:100px"></div>';
    result=await capture(bands,{width:480,background:'white'});assert(result.height>700);assert(result.colors.red>90&&result.colors.green>90&&result.colors.blue>90);assert(result.clean&&result.unchanged);record('Long document includes start, middle and end exactly once');
    result=await capture('- [x] Finished\n- [ ] Pending\n\n```javascript\nconst x = 42;\n```\n\n$\\frac{1}{2}$\n\n$$\nx^2 + y^2\n$$',{background:'white'});
    assert(result.stagedHTML.includes('data-type="taskItem"'));assert(result.stagedHTML.includes('checked=""'));assert(result.stagedHTML.includes('hljs-keyword'));assert(result.stagedHTML.includes('katex-html'));assert(result.clean);record('Task lists, code highlights and KaTeX HTML glyphs render');
    result=await capture('$\\frac{1}{2}$',{width:480,background:'white'});assert(result.glyphPixels>20);assert(['inline','inline-block'].includes(result.inlineMathDisplay));record('Inline formula paints actual glyph pixels without becoming a block');
    result=await capture('```mermaid\nflowchart LR\nA[Start] --> B[End]\n```',{background:'white'});assert.equal(result.type,'image/png');assert(result.stagedHTML.includes('image-export-diagram'));assert(result.colors.dark>0);assert(result.clean);record('Mermaid is awaited and captured as SVG image');
    const image='<img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22red%22/%3E%3C/svg%3E">';
    result=await capture(image,{background:'white'});assert.equal(result.type,'image/png');assert(result.clean);record('Images are decoded before capture');
    result=await capture('![Local](my%20%E5%9B%BE%E7%89%87.png)',{nativeImagePaths:true,sourcePath:'D:\\docs\\document.md'});assert.deepEqual(result.nativePaths,['D:\\docs\\my 图片.png']);assert.equal(result.type,'image/png');assert(result.clean);record('Relative local image paths decode spaces and Chinese before native conversion');
    result=await capture('<img src="data:image/png;base64,invalid">');assert.equal(result.code,'imageExportImageFailed');assert(result.clean&&result.unchanged);record('Broken image fails visibly with complete cleanup');
    result=await capture('<div style="height:40000px">Oversized</div>');assert.equal(result.code,'imageExportTooLarge');assert(result.clean&&result.unchanged);record('Oversized canvas is rejected before rendering');
    await page.evaluate(()=>{window.__originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});
    result=await capture('Encoding failure');await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.__originalToBlob;});assert.equal(result.code,'imageExportRenderFailed');assert(result.clean&&result.unchanged);record('Failed canvas encoding cleans up temporary document and clone');
    await page.evaluate(()=>{window.__originalGetContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(){throw new Error('Injected canvas render failure');};});
    result=await capture('Rendering failure');await page.evaluate(()=>{HTMLCanvasElement.prototype.getContext=window.__originalGetContext;});assert.equal(result.code,'imageExportRenderFailed');assert(result.clean&&result.unchanged);record('Failed renderer cleans up html2canvas iframe');
    result=await capture('<p onclick="window.__unsafe=true">Safe</p><iframe src="about:blank"></iframe><script>window.__unsafe=true</script><style>body{display:none}</style><link rel="stylesheet" href="/missing.css"><base href="https://invalid.example/"><meta http-equiv="refresh" content="0"><input autofocus>');assert(!result.stagedHTML.includes('onclick'));assert(!result.stagedHTML.includes('iframe'));assert(!result.stagedHTML.includes('<style'));assert(!result.stagedHTML.includes('<link'));assert(!result.stagedHTML.includes('autofocus'));assert(!await page.evaluate(()=>window.__unsafe));assert.equal(await page.evaluate(()=>getComputedStyle(document.body).display),'block');record('Snapshot strips executable HTML/global styles and prevents autofocus');
    console.log(`${passed.length} image capture browser checks passed`);
  } finally {if(browser)await browser.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));fs.rmSync(temporary,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
