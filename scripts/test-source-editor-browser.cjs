/* Real source UI + production editor/store. Native file/dialog IPC is mocked. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required.');
}
const harness = String.raw`<template><aside v-if="showSettings" class="test-editor-settings"><EditorMode/></aside><main class="el-scrollbar__wrap"><EditorPage/></main></template>
<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { undoDepth } from '@tiptap/pm/history';
import { useAppStore } from '/src/store/app';
import { useEditorStore } from '/src/store/editor';
import { useDraftsStore } from '/src/store/drafts';
import { useDocumentExportStore } from '/src/store/documentExport';
import { KeyBindingBuilder } from '/src/utils/keyBinding';
import { DEFAULT_SHORTCUT_PREFERENCES } from '/src/utils/shortcutPreferences';
import EditorPage from '/src/components/Editor.vue';
import EditorMode from '/src/components/preferences/EditorMode.vue';
import { usePreferencesStore } from '/src/store/preferences';
import themes, { setTheme } from '/src/theme';
import i18n from '/src/i18n';
const app = useAppStore(), document = useEditorStore(), drafts = useDraftsStore(), exports = useDocumentExportStore();
const preferences = usePreferencesStore(), showSettings = ref(false);
app.loading=false; app.autoSave=false;
let savedState, parserOriginal, parseLengths=[];
onMounted(async () => {
  await drafts.init();
  parserOriginal = document.editor.storage.markdown.parser.parse.bind(document.editor.storage.markdown.parser);
  document.editor.storage.markdown.parser.parse = (...args) => { parseLengths.push(typeof args[0]==='string'?args[0].length:0); return parserOriginal(...args); };
});
window.__source = {
  ready() { return drafts.registered && !!document.editor; },
  async fixture(markdown) { app.lifecycleBusy=false;preferences.applyEditorMode('wysiwyg');document.sourceMode='wysiwyg';document.editor.setEditable(true,false);await drafts.clearCurrent();await document.setContent(markdown);app.setFilepath('D:\\notes\\source.md',{exists:true,mtimeNs:'1',size:markdown.length,hash:'1'.repeat(64)},'D:\\notes\\source.md');app.isSave=true;await nextTick(); },
  async settings(value) { showSettings.value=value;await nextTick(); },
  async preference(value) { await preferences.saveEditorMode(value);await nextTick(); },
  async mode(value) { const result=await document.setSourceMode(value);await nextTick();return result; },
  async editWys(text) { document.editor.commands.insertContent(text);await nextTick(); },
  rememberWys() { savedState=document.editor.state; },
  sameWys() { const state=document.editor.state;return savedState.doc===state.doc && savedState.selection.eq(state.selection) && savedState.plugins.every(plugin=>!plugin.key.startsWith('history')||plugin.getState(savedState)===plugin.getState(state)); },
  async save() { return app.save(); },
  async draft() { await drafts.capture(true); },
  async export(format) { return exports.exportDocument(format); },
  async undo() { const result=document.undoSource();await nextTick();return result; },
  async redo() { const result=document.redoSource();await nextTick();return result; },
  async command(action) { return document.runSourceCommand(action); },
  sourceRange(value) { return document.openSourceRange(value.from,value.to,value.expected); },
  replace(value) { return document.replaceSourceRanges(value.ranges,value.expected); },
  mapping(value) { document.setAttachmentMapping(value); },
  busy(value) { app.lifecycleBusy=value; },
  bindings(value) { app.keyBinding?.unbind();app.keyBinding=new KeyBindingBuilder({...DEFAULT_SHORTCUT_PREFERENCES,...value});app.keyBinding.on(bind=>{if(bind.description.join('.')==='file.save'){void app.save();return true;}return false;}); },
  resetParseCounts() { parseLengths=[]; },
  failParser(value) { document.editor.storage.markdown.parser.parse=(...args)=>{parseLengths.push(typeof args[0]==='string'?args[0].length:0);if(value)throw new Error('Injected renderer failure');return parserOriginal(...args);}; },
  async locale(value) { i18n.global.locale.value=value;await nextTick(); },
  async theme(value) { const theme=themes.find(theme=>theme.value===value);app.theme=theme;setTheme(theme);await nextTick(); },
  translate(key) { return i18n.global.t(key); },
  snapshot() { return { markdown:document.getMarkdown(),source:document.sourceText,mode:document.sourceMode,selection:document.sourceSelection,history:document.sourceDocument.historyInfo(),pmUndo:undoDepth(document.editor.state),revision:app.editRevision,isSave:app.isSave,composing:document.sourceComposing,switching:document.sourceSwitching,error:document.sourceSwitchError,segmented:document.segmented,segments:document.segmentCount,parseLengths:[...parseLengths],json:document.editor.getJSON(),draftError:drafts.errorKey }; },
};
</script><style>body{margin:0}.el-scrollbar__wrap{height:700px;overflow:auto}.marknote{line-height:1.5}.test-editor-settings{position:fixed;right:0;top:0;width:320px;max-width:100vw;padding:12px;box-sizing:border-box;z-index:10;background:var(--contentBackgroundColor);color:var(--contentTextColor);border:1px solid var(--contentBorderColor)}</style>`;
function nativeMock() {
  window.os='windows';window.isTauri=true;
  const state={calls:[],draft:null,saved:null,clipboard:'',pick:'D:\\notes\\export.html'};window.__sourceNative=state;
  let id=1;
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback(){return id++;},unregisterCallback(){},convertFileSrc(value){return value;},
    async invoke(command,args={}) {
      state.calls.push({command,args});
      if(command==='render_markdown')throw new Error('Browser fallback');
      if(command==='get_config')return {code:0,data:{},info:''};
      if(command==='plugin:event|listen')return id++;
      if(command.startsWith('plugin:event|'))return;
      if(command==='draft_register'||command==='draft_remove')return;
      if(command==='draft_list')return [];
      if(command==='draft_write'){state.draft=args.draft;return;}
      if(command==='save_md'){state.saved=args.md;return {code:0,info:args.path,canonicalPath:args.path,version:{exists:true,mtimeNs:'2',size:args.md.length,hash:'2'.repeat(64)}};}
      if(command==='probe_file_version')return {code:0,info:args.path,canonicalPath:args.path,version:{exists:true,mtimeNs:'2',size:state.saved?.length||0,hash:'2'.repeat(64)}};
      if(command==='plugin:dialog|save')return state.pick;
      if(command==='plugin:dialog|message')return false;
      if(command==='plugin:clipboard-manager|write_text'){state.clipboard=args.text;return;}
      if(command==='plugin:clipboard-manager|read_text')return state.clipboard;
      if(command==='collect_word_equations')return [];
      if(['export_word','export_html','export_pdf'].includes(command))return {code:0};
      if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|')||command.startsWith('plugin:notification|'))return;
      throw new Error('Unexpected mock command: '+command);
    }
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
  window.Notification=class {static permission='granted';static async requestPermission(){return 'granted';}};
}
async function main() {
  const {chromium}=loadPlaywright();const {build,preview}=await import('vite');const vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.source-editor-browser-test-'));let server,browser;
  try {
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';import {createPinia} from 'pinia';import i18n from '/src/i18n';import '/src/styles.css';import '/src/scss/element-plus.scss';import '/src/scss/editor.scss';import '/src/scss/codeTheme.scss';import '/src/directives/loading/index.scss';import light from '/src/theme/style/light';import Harness from './Harness.vue';for(const [key,value] of Object.entries(light.style))document.documentElement.style.setProperty('--'+key,value);i18n.global.locale.value='en';createApp(Harness).use(createPinia()).use(i18n).mount('#test');");
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><div id="test"></div><script type="module" src="./main.js"></script></body></html>');
    const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0}};
    await build(config);console.log('Source settings migration harness built; starting Chrome checks');server=await preview(config);
    const executablePath=process.env.MARKNOTE_BROWSER_PATH||[chromium.executablePath(),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const page=await browser.newPage({viewport:{width:1100,height:740}});const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
    await page.addInitScript(nativeMock);await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`);await page.waitForFunction(()=>window.__source?.ready());
    const api=(method,argument)=>page.evaluate(({method,argument})=>window.__source[method](argument),{method,argument});
    const field=page.locator('[data-source-editor]');
    assert.equal(await page.locator('.source-mode-bar,.source-mode-choices').count(),0,'editor page has no mode selector');
    await api('settings',true);await page.locator('#editor-mode-preference').click();await page.getByRole('option',{name:await api('translate','editorModeSource'),exact:true}).click();await field.waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>localStorage.getItem('editorModePreferences')),'source','the mode is chosen and persisted in settings');await api('settings',false);
    const raw='#  Original\r\n\r\n__bold__  and [link][id]\n\n[id]: <relative.md> "Title"\r\n\r\n<!-- preserved -->\n';
    await api('fixture',raw);assert.equal((await api('snapshot')).markdown,raw,'freshly opened documents retain original Markdown');
    await api('editWys','WYS edit ');await api('rememberWys');const wys=await api('snapshot');
    await api('mode','source');await api('mode','split');await page.waitForFunction(()=>!document.querySelector('.source-preview-scroll').getAttribute('aria-busy')||document.querySelector('.source-preview-scroll').getAttribute('aria-busy')==='false');await api('mode','wysiwyg');
    assert.equal(await api('sameWys'),true,'no-change mode round trip keeps PM state/history');assert.equal((await api('snapshot')).pmUndo,wys.pmUndo);
    await api('fixture',raw);await api('mode','source');assert.equal(await field.inputValue(),raw.replace(/\r\n?/g,'\n'));
    await field.press('Control+End');await field.press('End');await field.type('source edit');
    let snap=await api('snapshot');assert.equal(snap.markdown,raw+'source edit','source input preserves unchanged mixed CRLF bytes');
    assert.equal(await api('mode','wysiwyg'),true);assert.equal((await api('snapshot')).pmUndo,0,'source edits restart only rendered history');
    await api('mode','source');assert.equal(await api('undo'),true);assert.equal((await api('snapshot')).markdown,raw,'source undo survives WYS mode');assert.equal(await api('redo'),true);
    console.log('PASS original raw/CRLF, unchanged PM history and independent source undo across modes');

    await api('draft');assert.equal(await page.evaluate(()=>window.__sourceNative.draft.markdown),raw+'source edit');
    assert.equal(await api('save'),true);assert.equal(await page.evaluate(()=>window.__sourceNative.saved),raw+'source edit');
    await field.press('Control+End');await field.type(' after save');const exported=(await api('snapshot')).markdown;
    assert.equal(await api('export','word'),true);assert.equal(await page.evaluate(()=>window.__sourceNative.calls.filter(call=>call.command==='export_word').at(-1).args.markdown),exported);
    assert.equal(await api('export','html'),true);assert.ok(await page.evaluate(()=>window.__sourceNative.calls.filter(call=>call.command==='export_html').at(-1).args.html.includes('source edit after save')));
    await api('command','selectAll');assert.equal((await api('snapshot')).selection.to,exported.length);assert.equal(await api('command','copy'),true);assert.equal(await page.evaluate(()=>window.__sourceNative.clipboard),exported.replace(/\r\n?/g,'\n'));
    console.log('PASS source canonical getter feeds real save, draft, Word/HTML export and clipboard commands');

    await api('fixture','# Failure\n\nText');await api('mode','source');await field.fill('# Source remains\n\nNew text');await api('failParser',true);
    assert.equal(await api('mode','wysiwyg'),false);snap=await api('snapshot');assert.equal(snap.mode,'source');assert.equal(snap.error,true);assert.equal(snap.markdown,'# Source remains\n\nNew text');
    await api('mode','split');await page.waitForFunction(()=>document.querySelector('.source-preview-status').textContent.includes(window.__source.translate('sourcePreviewFailed')));
    await api('failParser',false);await page.locator('.source-preview-status button').click();await page.waitForFunction(()=>document.querySelector('.source-preview-content')?.textContent.includes('Source remains'));
    await field.dispatchEvent('compositionstart');await field.fill('# Source remains\n\nNew text中文');
    snap=await api('snapshot');assert.equal(snap.composing,true);const before=await page.evaluate(()=>window.__sourceNative.calls.filter(call=>call.command==='save_md'||call.command.startsWith('export_')).length);
    assert.equal(await api('save'),false);assert.equal(await api('export','word'),false);assert.equal(await api('mode','wysiwyg'),false);
    assert.equal(await page.evaluate(()=>window.__sourceNative.calls.filter(call=>call.command==='save_md'||call.command.startsWith('export_')).length),before);
    const selectionBefore=await field.evaluate(element=>element.selectionStart);await field.dispatchEvent('keydown',{key:'z',ctrlKey:true,isComposing:true});assert.equal(await field.evaluate(element=>element.selectionStart),selectionBefore,'IME does not consume undo');
    await field.dispatchEvent('compositionend');assert.equal((await api('snapshot')).composing,false);assert.equal(await api('undo'),true);assert.equal((await api('snapshot')).markdown,'# Source remains\n\nNew text');
    await api('busy',true);assert.equal(await field.evaluate(element=>element.readOnly),true);await field.evaluate(element=>{element.value='must not write';element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText'}));});assert.equal((await api('snapshot')).markdown,'# Source remains\n\nNew text');await api('busy',false);
    console.log('PASS render/preview failures retain source, retry succeeds, lifecycle and IME guards reject side effects');

    await api('fixture','![local](old.png)\n\nBefore target after');await api('mode','source');await field.fill('![local](old.png)\n\nBefore target after edited');await api('mapping',{'old.png':'new-directory/longer.png'});
    snap=await api('snapshot');assert.equal(snap.source,snap.markdown,'Save As aliases update the displayed source');assert.ok((await field.inputValue()).includes('new-directory/longer.png'));
    const offset=snap.markdown.indexOf('target');assert.equal(await api('sourceRange',{from:offset,to:offset+6,expected:snap.markdown}),true);assert.equal(await field.evaluate(element=>element.value.slice(element.selectionStart,element.selectionEnd)),'target');
    assert.equal(await api('replace',{ranges:[{from:offset,to:offset+6,replacement:'replacement'}],expected:snap.markdown}),true);assert.equal(await api('undo'),true);assert.ok((await api('snapshot')).markdown.includes('target'));assert.equal(await api('undo'),true);assert.ok(!(await api('snapshot')).markdown.includes(' edited'));assert.ok((await api('snapshot')).markdown.includes('new-directory/longer.png'));
    assert.equal(await api('sourceRange',{from:0,to:1,expected:'stale'}),false);
    await api('fixture','![local][img]\n\nBefore target after\n\n[img]: old.png');await api('mode','source');await field.press('Control+End');await field.type(' edited');await api('mapping',{'old.png':'reference-directory/new.png'});
    snap=await api('snapshot');const referenceOffset=snap.markdown.indexOf('target');assert.equal(await api('sourceRange',{from:referenceOffset,to:referenceOffset+6,expected:snap.markdown}),true);assert.equal(await field.evaluate(element=>element.value.slice(element.selectionStart,element.selectionEnd)),'target');
    assert.equal(await api('undo'),true);assert.ok(!(await api('snapshot')).markdown.includes(' edited'));assert.ok((await api('snapshot')).markdown.includes('reference-directory/new.png'));
    console.log('PASS rebased source display, exact whole-document search ranges and undo-safe replacement');

    await api('fixture','Key bindings original');await api('mode','source');await field.fill('Key bindings changed');
    await api('bindings',{'edit.undo':'Mod+U','edit.redo':'Mod+Shift+U','edit.selectAll':'Mod+Shift+A','edit.copy':'Mod+Alt+K','edit.cut':'Mod+Alt+X','edit.paste':'Mod+Alt+V'});
    await field.press('Control+z');assert.equal((await api('snapshot')).markdown,'Key bindings changed','remapped undo suppresses the old native default');
    await field.press('Control+u');assert.equal((await api('snapshot')).markdown,'Key bindings original');await field.press('Control+Shift+u');assert.equal((await api('snapshot')).markdown,'Key bindings changed');
    await field.press('Control+Shift+a');assert.equal((await api('snapshot')).selection.to,'Key bindings changed'.length);
    await field.press('Control+Alt+k');await page.waitForFunction(()=>window.__sourceNative.clipboard==='Key bindings changed');
    await field.press('Control+Alt+x');await page.waitForFunction(()=>window.__source.snapshot().source==='');await field.press('Control+Alt+v');await page.waitForFunction(()=>window.__source.snapshot().source==='Key bindings changed');
    await field.press('Control+s');await page.waitForFunction(()=>window.__sourceNative.saved==='Key bindings changed');
    console.log('PASS configured source undo/redo/selection/clipboard and global Save shortcuts');

    await api('fixture','# Start\n\nBody');await api('mode','split');await field.fill('# Safe preview\n\n$x^2 + 1$\n\n```javascript\nconst answer = 42;\n```\n\n<script>window.__previewXss=1</script>\n<img src="x" onerror="window.__previewXss=2">\n<iframe srcdoc="<script>window.__previewXss=3</script>"></iframe>\n<a href="javascript:window.__previewXss=4">link</a>');
    await page.waitForFunction(()=>document.querySelector('.source-preview-content')?.textContent.includes('Safe preview'));
    assert.equal(await page.evaluate(()=>window.__previewXss),undefined);assert.equal(await page.locator('.source-preview-content script,.source-preview-content iframe,.source-preview-content [onerror]').count(),0);assert.ok(await page.locator('.source-preview-content math').count()>0);assert.ok(await page.locator('.source-preview-content pre .hljs-keyword').count()>0);
    const large=Array.from({length:1800},(_,index)=>'# Section '+index+'\n\nparagraph '+index+' '+('word '.repeat(70))+'\n\n').join('');
    await api('fixture',large);assert.equal((await api('snapshot')).segmented,true);await api('mode','split');await page.waitForFunction(()=>document.querySelector('.source-preview-scroll').getAttribute('aria-busy')==='false');await api('resetParseCounts');
    await field.press('Control+End');await field.type(' burst');await page.waitForTimeout(100);assert.ok((await api('snapshot')).parseLengths.length<=1,'preview does not parse once per keystroke');
    await page.waitForTimeout(450);snap=await api('snapshot');assert.ok(snap.parseLengths.length<=2);assert.ok(snap.parseLengths.every(length=>length<=65536),'preview renderer receives only bounded source windows');assert.equal(snap.markdown,large+' burst','source always includes all WYS segments');
    const target=large.indexOf('# Section 1600');await api('sourceRange',{from:target,to:target+14,expected:snap.markdown});await page.waitForTimeout(450);assert.ok(await page.locator('.source-preview-content').textContent().then(text=>text.includes('Section 1600')));
    const syncButton=page.locator('.source-preview-actions').getByRole('button',{name:await api('translate','sourceSyncScroll'),exact:true});
    const previewPane=page.locator('.source-preview-scroll');await syncButton.click();const independentPreview=await previewPane.evaluate(element=>element.scrollTop);
    await field.evaluate(element=>{element.scrollTop=12000;element.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(80);assert.equal(await previewPane.evaluate(element=>element.scrollTop),independentPreview,'disabled sync leaves the preview scrollbar independent');
    await syncButton.click();const nearby=large.indexOf('# Section 1610'),sourceTop=large.slice(0,nearby).split('\n').length*22;
    await field.evaluate((element,top)=>{element.scrollTop=top;element.dispatchEvent(new Event('scroll'));},sourceTop);await page.waitForTimeout(80);assert.notEqual(await previewPane.evaluate(element=>element.scrollTop),independentPreview,'source scrolling follows mapped preview blocks');
    const sourceBeforePreview=await field.evaluate(element=>element.scrollTop);await previewPane.evaluate(element=>{element.scrollTop=0;element.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(80);assert.notEqual(await field.evaluate(element=>element.scrollTop),sourceBeforePreview,'preview scrolling follows the source line');
    await page.locator('.source-preview-actions').getByRole('button',{name:await api('translate','sourceLocatePreview'),exact:true}).click();assert.equal(await field.evaluate(element=>element===document.activeElement),true,'preview location returns keyboard focus to source');
    console.log('PASS independent pane scrollbars, bidirectional block/line sync and preview-to-source focus');
    await api('locale','zhCn');await api('theme','dark');await page.setViewportSize({width:390,height:740});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.source-workspace').evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length),1);
    const sourceHeight=await field.evaluate(element=>element.clientHeight);assert.ok(sourceHeight>150);assert.ok(await page.locator('.source-preview-scroll').evaluate(element=>element.clientHeight)>150);
    fs.mkdirSync(path.join(root,'outputs','source-editor'),{recursive:true});await page.screenshot({path:path.join(root,'outputs','source-editor','split-chinese-dark-narrow.png')});
    assert.deepEqual(errors,[]);console.log('PASS sanitized math/code preview, debounced bounded full-source editing, remote positioning and Chinese dark/narrow panes');
    console.log('source editor browser: 7 groups passed');
  } finally {
    if(browser)await browser.close();if(server)await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
    if(path.dirname(path.resolve(temporary))===root&&path.basename(temporary).startsWith('.source-editor-browser-test-'))fs.rmSync(temporary,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
