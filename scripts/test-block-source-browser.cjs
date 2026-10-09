/* Focused browser checks for Mermaid and block formula source actions. */
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

const harness = String.raw`<template><main id="test-editor"><EditorContent :editor="editor" /></main></template>
<script setup>
import { nextTick, onBeforeUnmount } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { undoDepth, redoDepth } from '@tiptap/pm/history';
import { lowlight } from 'lowlight/lib/all';
import { CodeBlock } from '/src/extensions/codeBlock2';
import { Katex } from '/src/extensions/katex';
import i18n from '/src/i18n';

const formula = 'E = mc^2';
const secondFormula = '\\frac{a}{b}';
const diagram = 'flowchart LR\nA[Start] --> B[End]';
const code = 'const answer = 42;\nconsole.log(answer);';
window.__selectionTrace=[];
const editor = new Editor({
  injectCSS: false,
  extensions: [StarterKit.configure({ codeBlock: false }), CodeBlock.configure({ lowlight }), Katex],
  editorProps: { attributes: { class: 'marknote code-theme-default' } },
  onSelectionUpdate({transaction}) {window.__selectionTrace.push(transaction.selection.toJSON());},
  content: {type:'doc',content:[
    {type:'paragraph',content:[{type:'text',text:'Before formula'}]},
    {type:'katex',content:[{type:'text',text:formula}]},
    {type:'paragraph',content:[{type:'text',text:'Between formulas'}]},
    {type:'katex',content:[{type:'text',text:secondFormula}]},
    {type:'paragraph',content:[{type:'text',text:'Before empty formula'}]},
    {type:'katex'},
    {type:'paragraph',content:[{type:'text',text:'Before Mermaid'}]},
    {type:'codeBlock',attrs:{language:'mermaid'},content:[{type:'text',text:diagram}]},
    {type:'paragraph',content:[{type:'text',text:'Before plain code'}]},
    {type:'codeBlock',attrs:{language:'javascript'},content:[{type:'text',text:code}]},
    {type:'paragraph',content:[{type:'text',text:'After code'}]},
  ]},
});
const locate = (type, index) => {
  const nodes=[];
  editor.state.doc.descendants((node,pos)=>{if(node.type.name===type)nodes.push({node,pos});});
  if(!nodes[index])throw new Error('Missing node '+type+' '+index);
  return nodes[index];
};
window.__blockTest = {
  sources: {formula,secondFormula,diagram,code},
  async select({type,index=0,node=false,end=false}) {
    const {pos,node:block}=locate(type,index);
    editor.commands.focus();
    if(node)editor.commands.setNodeSelection(pos);
    else editor.commands.setTextSelection(pos+1+(end?block.content.size:0));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await nextTick();
  },
  async setLocale(value) { i18n.global.locale.value=value; await nextTick(); },
  async editable(value) { editor.setEditable(value); await nextTick(); },
  async theme(value) {
    const dark=value==='dark';
    const variables={contentBackgroundColor:dark?'#282828':'#ffffff',contentTextColor:dark?'#cbcbcb':'#3e3e3e',contentBorderColor:dark?'#9b9b9b':'#babec1',contentBackgroundColorActive:dark?'#383838':'#f1f3f5',contentTextColorActive:dark?'#eeeeee':'#616161',editorEchoTextColor:dark?'#aaa':'#777'};
    for(const [key,color] of Object.entries(variables))document.documentElement.style.setProperty('--'+key,color);
    document.documentElement.classList.toggle('dark',dark);
    const surface=document.querySelector('.marknote');
    surface.classList.toggle('code-theme-default',!dark);
    surface.classList.toggle('code-theme-dark',dark);
    window.__native.theme(value);
    await nextTick();
  },
  snapshot() {
    return {document:editor.state.doc.toJSON(),selection:editor.state.selection.toJSON(),undo:undoDepth(editor.state),redo:redoDepth(editor.state)};
  },
  diagnostics() {
    const native=window.getSelection();
    return {selection:editor.state.selection.toJSON(),viewSelection:editor.view.state.selection.toJSON(),activeClass:document.activeElement?.className,trace:window.__selectionTrace.slice(-8),nativeAnchor:native?.anchorNode?.textContent?.slice(0,40),selectedWrappers:Array.from(document.querySelectorAll('.ProseMirror-selectednode')).map(node=>node.className)};
  },
  async replaceSource({type,index,text}) {
    const {pos,node}=locate(type,index);
    editor.view.dispatch(editor.state.tr.insertText(text,pos+1,pos+1+node.content.size));
    await nextTick();
  },
};
onBeforeUnmount(()=>editor.destroy());
</script>
<style>
html,body{margin:0;min-height:100%;background:var(--contentBackgroundColor);}
#test-editor{max-width:960px;margin:auto;}
.marknote{padding:24px;}
.marknote-katex,.marknote-codeblock{min-width:0;}
</style>`;

async function main() {
  const { chromium } = loadPlaywright();
  const { build, preview } = await import('vite');
  const vue = (await import('@vitejs/plugin-vue')).default;
  const temporary = fs.mkdtempSync(path.join(root, '.block-source-browser-test-'));
  let server, browser;
  const pageErrors = [];
  const passed = [];
  try {
    fs.writeFileSync(path.join(temporary, 'Harness.vue'), harness);
    fs.writeFileSync(path.join(temporary, 'main.js'), [
      "import { createApp } from 'vue';", "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';", "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';",
      "import '/src/scss/editor.scss';", "import '/src/scss/codeTheme.scss';", "import 'katex/dist/katex.min.css';",
      "import Harness from './Harness.vue';", "createApp(Harness).use(i18n).mount('#test-root');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="test-root"></div><script type="module" src="./main.js"></script></body></html>');
    const config = {root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0}};
    console.log('Building block source browser harness');
    await build(config);
    server = await preview(config);
    const executablePath = process.env.MARKNOTE_BROWSER_PATH || (fs.existsSync(chromium.executablePath()) ? undefined : ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync));
    browser = await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const page = await browser.newPage({viewport:{width:1050,height:800}});
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('lang','en');
      let callbackId=0;
      const callbacks=new Map(), listeners=[];
      const state={writes:[],fail:false,delay:false,pending:[]};
      window.__native={
        state,
        reset(options={}){state.writes=[];state.fail=false;state.delay=false;Object.assign(state,options);},
        release(){const pending=state.pending.splice(0);for(const done of pending)done();},
        theme(type){for(const listener of listeners)if(listener.event==='theme')callbacks.get(listener.handler)?.({event:'theme',id:1,payload:{type}});},
      };
      window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
      window.__TAURI_INTERNALS__={
        transformCallback(callback){const id=++callbackId;callbacks.set(id,callback);return id;},
        async invoke(command,args){
          if(command==='plugin:event|listen'){listeners.push(args);return listeners.length;}
          if(command==='plugin:event|unlisten')return;
          if(command==='plugin:clipboard-manager|write_text'){
            state.writes.push(args.text);
            if(state.delay)await new Promise(done=>state.pending.push(done));
            if(state.fail)throw new Error('Test clipboard failure');
            return;
          }
          throw new Error('Unexpected native command '+command);
        },
      };
    });
    const url = `http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    await page.goto(url);
    await page.waitForFunction(() => window.__blockTest);
    await page.locator('.marknote-mermaid .mermaid-render svg').waitFor();
    const api = (method, args) => page.evaluate(({method,args})=>window.__blockTest[method](args),{method,args});
    const native = (options) => page.evaluate(options=>window.__native.reset(options),options);
    const writes = () => page.evaluate(()=>window.__native.state.writes);
    const sources = await page.evaluate(()=>window.__blockTest.sources);
    const math = index => page.locator('.marknote-katex').nth(index);
    const mermaid = page.locator('.marknote-mermaid');
    const plain = page.locator('.marknote-codeblock').nth(1);
    const codeButton = block => block.locator('button[aria-pressed]');
    // The source toggle is the first action; copying is the last action.
    const copy = block => block.locator('.block-source-actions button').last();
    const record = name => {passed.push(name);console.log('PASS '+name);};
    const unchanged = (before,after) => assert.deepEqual(after,before,'action retains document, selection and undo history');
    const readSourceStyles = () => page.evaluate(() => {
      const read = selector => {
        const style=getComputedStyle(document.querySelector(selector));
        return Object.fromEntries(['paddingTop','paddingRight','paddingBottom','paddingLeft','backgroundColor','color','fontFamily','fontSize','boxShadow','borderRadius','whiteSpace','tabSize'].map(key=>[key,style[key]]));
      };
      return {formula:read('.marknote-katex pre.block-source'),diagram:read('.marknote-mermaid pre.block-source'),formulaCode:read('.marknote-katex pre.block-source code'),diagramCode:read('.marknote-mermaid pre.block-source code')};
    });
    const matchingSourceStyles = async () => {
      const styles=await readSourceStyles();
      assert.deepEqual(styles.formula,styles.diagram,'formula and Mermaid source surfaces share computed styles');
      assert.deepEqual(styles.formulaCode,styles.diagramCode,'formula and Mermaid source code share computed styles');
    };

    await api('select',{type:'paragraph',index:0});
    for(let index=0;index<3;index++)assert.equal(await math(index).locator('.katex-toolbar').isVisible(),false);
    assert.equal(await mermaid.locator('.codeblock-wrapper').isVisible(),false);
    await math(0).locator('.katex-content').focus();
    await math(0).locator('.katex-toolbar').waitFor({state:'visible'});
    assert.equal(await math(0).locator('.katex-content').evaluate(element=>element===document.activeElement),true);
    await api('select',{type:'paragraph',index:0});
    await math(0).locator('.katex-toolbar').waitFor({state:'hidden'});
    await math(0).locator('.katex-content').click();
    await math(0).locator('.katex-toolbar').waitFor({state:'visible'});
    assert.equal(await math(0).locator('.katex-source').isVisible(),false);
    await api('select',{type:'katex',index:0,node:true});
    assert.equal(await math(0).locator('.katex-toolbar').isVisible(),true);
    assert.equal(await math(0).locator('.katex-source').isVisible(),false);
    assert.equal(await math(1).locator('.katex-toolbar').isVisible(),false);
    assert.equal(await codeButton(math(0)).getAttribute('aria-label'),'Code');
    await codeButton(math(0)).click();
    assert.equal(await math(0).locator('.katex-source').isVisible(),true);
    assert.equal(await codeButton(math(0)).getAttribute('aria-pressed'),'true');
    const sourceSelection = await api('snapshot');
    assert.equal(sourceSelection.selection.type,'text');
    await api('select',{type:'katex',index:0,end:true});
    await page.keyboard.type(' + 1');
    await page.waitForFunction(()=>document.querySelector('.marknote-katex .katex-source').textContent.endsWith(' + 1'));
    assert.match(await math(0).locator('.katex-content').textContent(),/1/);
    const beforeClose = await api('snapshot');
    await codeButton(math(0)).click();
    unchanged(beforeClose,await api('snapshot'));
    assert.equal(await math(0).locator('.katex-source').isVisible(),false);
    await api('select',{type:'katex',index:1,node:true});
    await math(0).locator('.katex-toolbar').waitFor({state:'hidden'});
    assert.equal(await math(0).locator('.katex-toolbar').isVisible(),false);
    assert.equal(await math(1).locator('.katex-source').isVisible(),false);
    await codeButton(math(1)).click();
    assert.equal(await math(1).locator('.katex-source').isVisible(),true);
    assert.equal(await math(0).locator('.katex-source').isVisible(),false);
    record('Focused formula actions toggle source, edit live preview and stay isolated across multiple blocks');

    await math(2).locator('.katex-content').click();
    await math(2).locator('.katex-source').waitFor({state:'visible'});
    assert.equal(await math(2).locator('.katex-source').isVisible(),true);
    await page.keyboard.type('x^2');
    assert.equal(await math(2).locator('.katex-source').textContent(),'x^2');
    assert.equal(await math(2).locator('.katex-empty').count(),0);
    assert.match(await math(2).locator('.katex-content').textContent(),/x/);
    record('Empty formula exposes an editable source and accepts typing immediately');

    await api('select',{type:'codeBlock',index:0,node:true});
    assert.equal(await mermaid.locator('.codeblock-wrapper').isVisible(),true);
    assert.equal(await mermaid.locator('pre').isVisible(),false);
    await codeButton(mermaid).click();
    assert.equal(await mermaid.locator('pre').isVisible(),true);
    await matchingSourceStyles();
    await codeButton(mermaid).click();
    assert.equal(await mermaid.locator('pre').isVisible(),false);
    await api('select',{type:'codeBlock',index:1});
    assert.equal(await plain.locator('pre').isVisible(),true);
    assert.equal(await codeButton(plain).count(),0);
    record('Formula and Mermaid source styles match, Mermaid keeps its toggle and plain code retains copy');

    for (const [block,type,index,source] of [[math(1),'katex',1,sources.secondFormula],[mermaid,'codeBlock',0,sources.diagram],[plain,'codeBlock',1,sources.code]]) {
      await api('select',{type,index,node:true});
      await native();
      const before=await api('snapshot');
      await copy(block).click();
      await page.waitForFunction(()=>window.__native.state.writes.length===1);
      assert.deepEqual(await writes(),[source]);
      await copy(block).getAttribute('aria-label').then(label=>assert.equal(label,'Copied'));
      unchanged(before,await api('snapshot'));
    }
    record('Formula, Mermaid and ordinary code copy their exact raw source and retain editor state');

    await api('select',{type:'katex',index:0,node:true});
    if(await codeButton(math(0)).getAttribute('aria-pressed')!=='true')await codeButton(math(0)).click();
    await math(0).locator('.katex-source').waitFor({state:'visible'});
    await matchingSourceStyles();
    await native({delay:true});
    const delayedBefore=await api('snapshot');
    const delayedCopy=copy(math(0));
    await delayedCopy.click();
    assert.equal(await delayedCopy.getAttribute('aria-busy'),'true');
    await delayedCopy.click({force:true});
    assert.deepEqual(await writes(),[sources.formula+' + 1']);
    unchanged(delayedBefore,await api('snapshot'));
    await page.evaluate(()=>window.__native.release());
    await page.waitForFunction(()=>document.querySelector('.marknote-katex button[aria-busy]').getAttribute('aria-busy')==='false');
    await native({fail:true});
    const failedBefore=await api('snapshot');
    await delayedCopy.click();
    await page.waitForFunction(()=>document.querySelector('.marknote-katex button[aria-busy]').getAttribute('aria-label')==='Copy failed. Try again.');
    unchanged(failedBefore,await api('snapshot'));
    await native();
    await delayedCopy.click();
    await page.waitForFunction(()=>document.querySelector('.marknote-katex button[aria-busy]').getAttribute('aria-label')==='Copied');
    assert.equal((await writes()).length,1);
    record('Delayed copy prevents duplicate writes and failure preserves state with working retry');

    await native();
    await codeButton(math(0)).focus();
    await page.keyboard.press('Tab');
    assert.equal(await delayedCopy.evaluate(element=>element===document.activeElement),true);
    const keyboardBefore=await api('snapshot');
    await page.keyboard.press('Enter');
    assert.equal((await writes()).length,1);
    assert.equal(await delayedCopy.evaluate(element=>element===document.activeElement),true);
    unchanged(keyboardBefore,await api('snapshot'));
    await page.keyboard.press('Space');
    assert.equal((await writes()).length,2);
    record('Keyboard Tab, Enter and Space access copying and retain button focus');

    await api('editable',false);
    for (const [block,type,index,source] of [[math(1),'katex',1,sources.secondFormula],[mermaid,'codeBlock',0,sources.diagram],[plain,'codeBlock',1,sources.code]]) {
      if(type==='katex'){
        await block.locator('.katex-content').click();
        try { await block.locator('.katex-toolbar').waitFor({state:'visible',timeout:5000}); }
        catch(error) { console.error('Read-only formula diagnostics:',await api('diagnostics')); throw error; }
      }else await api('select',{type,index,node:true});
      await native();
      const readonlyBefore=await api('snapshot');
      await copy(block).click();
      assert.deepEqual(await writes(),[source]);
      unchanged(readonlyBefore,await api('snapshot'));
      if(await codeButton(block).count()){
        await codeButton(block).click();
        unchanged(readonlyBefore,await api('snapshot'));
      }
    }
    await api('editable',true);
    record('Read-only formulas, Mermaid and code support source actions without content changes');

    await api('setLocale','zhCn');
    await api('theme','dark');
    await page.setViewportSize({width:390,height:760});
    await api('select',{type:'katex',index:0,node:true});
    await math(0).locator('.katex-source').waitFor({state:'visible'});
    await matchingSourceStyles();
    assert.equal(await codeButton(math(0)).getAttribute('aria-label'),'代码');
    await native({fail:true});
    await copy(math(0)).click();
    await page.waitForFunction(()=>document.querySelector('.marknote-katex button[aria-busy]').getAttribute('aria-label')==='复制失败，请重试');
    const bounds=await math(0).locator('.katex-toolbar').evaluate(element=>{
      const toolbar=element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('button')).map(button=>{
        const rect=button.getBoundingClientRect();
        return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,toolbarTop:toolbar.top,viewport:innerWidth};
      });
    });
    for(const button of bounds){assert(button.left>=0&&button.right<=button.viewport,'actions fit narrow viewport');assert(button.bottom>button.top);}
    await page.screenshot({path:path.join(temporary,'formula-dark-zh-narrow.png'),fullPage:true});
    if(process.env.MARKNOTE_BLOCK_SOURCE_SCREENSHOT_DIR){fs.mkdirSync(process.env.MARKNOTE_BLOCK_SOURCE_SCREENSHOT_DIR,{recursive:true});fs.copyFileSync(path.join(temporary,'formula-dark-zh-narrow.png'),path.join(process.env.MARKNOTE_BLOCK_SOURCE_SCREENSHOT_DIR,'formula-dark-zh-narrow.png'));}
    await api('theme','light');
    await matchingSourceStyles();
    await api('setLocale','en');
    assert.equal(await codeButton(math(0)).getAttribute('aria-label'),'Code');
    record('Chinese and English labels, dark/light themes and narrow-screen actions render correctly');
    assert.deepEqual(pageErrors,[],'browser does not emit unhandled errors');
    console.log('Block source browser checks passed: '+passed.length+' workflows.');
  } finally {
    await browser?.close();
    await new Promise(resolve=>server?.httpServer.close(resolve)||resolve());
    const relative=path.relative(root,path.resolve(temporary));
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative),'temporary cleanup stays inside workspace');
    fs.rmSync(temporary,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
