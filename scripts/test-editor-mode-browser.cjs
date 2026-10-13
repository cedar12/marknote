/* Settings-owned editor modes: real Preferences, production Editor and IPC boundary mocks. */
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
const harness = String.raw`<template>
  <div v-show="settingsVisible"><Preferences/></div>
  <main v-if="editorSurface" v-show="!settingsVisible" class="test-editor-page el-scrollbar__wrap"><EditorPage/></main>
</template>
<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { undoDepth } from '@tiptap/pm/history';
import Preferences from '/src/components/Preferences.vue';
import EditorPage from '/src/components/Editor.vue';
import { usePreferencesStore } from '/src/store/preferences';
import { useEditorStore } from '/src/store/editor';
import { useAppStore } from '/src/store/app';
import { useDocumentSearchStore } from '/src/store/documentSearch';
import i18n from '/src/i18n';
import themes, { setTheme } from '/src/theme';
const preferences=usePreferencesStore(), document=useEditorStore(), app=useAppStore();
const editorSurface=new URL(location.href).searchParams.get('surface')!=='settings';
const settingsVisible=ref(true);let parserOriginal;
onMounted(async()=>{if(editorSurface){await document.setContent('# Preference fixture\n\nOriginal text\n');parserOriginal=document.editor.storage.markdown.parser.parse.bind(document.editor.storage.markdown.parser);}app.autoSave=false;app.isSave=true;});
window.__modeTest={
  snapshot(){return {preference:preferences.editorMode,requestRevision:preferences.editorModeRevision,mode:document.sourceMode,saving:preferences.savingEditorMode,saveError:preferences.editorModeSaveError,syncError:preferences.editorModeSyncError,editorPresent:Boolean(document.editor),rendering:document.renderingDocument,composing:document.sourceComposing,busy:app.lifecycleBusy,markdown:document.editor?document.getMarkdown():null,pmUndo:document.editor?undoDepth(document.editor.state):null,editRevision:app.editRevision};},
  translate(key){return i18n.global.t(key);},
  async settings(value){settingsVisible.value=value;await nextTick();if(!value)document.focus();},
  async save(value){await preferences.saveEditorMode(value);await nextTick();},
  async edit(value){document.editor.commands.insertContent(value);await nextTick();},
  busy(value){app.lifecycleBusy=value;},
  resourceBusy(value){app.resourceTasks=value?1:0;},
  searchComposing(value){useDocumentSearchStore().composing=value;},
  async locateSource(){const markdown=document.getMarkdown();return document.openSourceRange(0,Math.min(5,markdown.length),markdown);},
  failParser(value){document.editor.storage.markdown.parser.parse=(...args)=>{if(value)throw new Error('Injected render failure');return parserOriginal(...args);};},
  async locale(value){i18n.global.locale.value=value;await nextTick();},
  async theme(value){const theme=themes.find(item=>item.value===value);app.theme=theme;setTheme(theme);await nextTick();},
};
</script>
<style>body{margin:0}.test-editor-page{height:calc(100vh - 30px);overflow:auto;background:var(--contentBackgroundColor)}</style>`;
function nativeMock() {
  const callbacks=new Map(),listeners=new Map();let next=1;
  window.os='windows';window.isTauri=true;
  const preferencesWindow=new URL(location.href).searchParams.get('surface')==='settings';
  const state={calls:[],storageFailure:false,eventFailure:false,delayEvent:false,release:null,
    async emit(event,payload){for(const [id,listener] of listeners)if(listener.event===event)await callbacks.get(listener.handler)?.({event,id,payload});},
    ready(){return [...listeners.values()].some(listener=>listener.event==='editorModePreferences');},
  };window.__modeNative=state;
  const setItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key==='editorModePreferences'&&state.storageFailure)throw new DOMException('Injected storage failure','QuotaExceededError');return setItem.call(this,key,value);};
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:preferencesWindow?'preferences':'main'},currentWebview:{label:preferencesWindow?'preferences':'main'}},
    transformCallback(callback,once=false){const id=next++;callbacks.set(id,value=>{if(once)callbacks.delete(id);return callback(value);});return id;},unregisterCallback(id){callbacks.delete(id);},convertFileSrc(value){return value;},
    async invoke(command,args={}) {
      state.calls.push({command,args});
      if(command==='plugin:event|listen'){const id=next++;listeners.set(id,{event:args.event,handler:args.handler});return id;}
      if(command==='plugin:event|emit'||command==='plugin:event|emit_to'){
        if(args.event==='editorModePreferences'){
          if(state.eventFailure)throw new Error('Injected synchronization failure');
          if(state.delayEvent){state.delayEvent=false;await new Promise(resolve=>state.release=resolve);}
        }
        await state.emit(args.event,args.payload);return;
      }
      if(command==='plugin:event|unlisten'){listeners.delete(args.eventId);return;}
      if(command==='get_config')return {code:0,data:{},info:''};
      if(command==='cmd_args')return [];
      if(command==='theme_list')return [];
      if(command==='restore_window_size'||command==='remember_window_size')return;
      if(command==='render_markdown')throw new Error('Use the actual browser parser');
      if(command==='plugin:notification|is_permission_granted')return true;
      if(command==='plugin:notification|request_permission')return 'granted';
      if(command==='draft_register'||command==='draft_remove')return;
      if(command==='draft_list')return [];
      if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|')||command.startsWith('plugin:global-shortcut|')||command.startsWith('plugin:notification|'))return command.includes('is_')?false:undefined;
      throw new Error('Unexpected native command: '+command);
    }
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(_event,id){listeners.delete(id);}};
  window.Notification=class {static permission='granted';static async requestPermission(){return 'granted';}};
}
async function main() {
  const {chromium}=loadPlaywright(),{build,preview}=await import('vite'),vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.editor-mode-browser-test-'));let server,browser;const errors=[];
  try {
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),"import {createApp} from 'vue';import {createPinia} from 'pinia';import i18n from '/src/i18n';import '/src/styles.css';import '/src/scss/element-plus.scss';import 'element-plus/theme-chalk/dark/css-vars.css';import '/src/scss/editor.scss';import '/src/scss/codeTheme.scss';import '/src/directives/loading/index.scss';import light from '/src/theme/style/light';import Harness from './Harness.vue';for(const [key,value] of Object.entries(light.style))document.documentElement.style.setProperty('--'+key,value);document.documentElement.style.setProperty('--titleBarHeight','30px');i18n.global.locale.value='en';const app=createApp(Harness);app.config.errorHandler=error=>{window.__modeVueErrors||=[];window.__modeVueErrors.push(String(error));};app.use(createPinia()).use(i18n).mount('#app');");
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><div id="marknote-titlbar"></div><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const config={root,configFile:false,plugins:[vue()],logLevel:'error',build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},preview:{host:'127.0.0.1',port:0}};
    console.log('Building editor mode preferences browser harness');await build(config);console.log('Editor mode settings harness built; starting Chrome checks');server=await preview(config);
    const executablePath=process.env.MARKNOTE_BROWSER_PATH||[chromium.executablePath(),'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    const context=await browser.newContext({viewport:{width:1100,height:740},reducedMotion:'reduce'});await context.addInitScript(nativeMock);
    const url=`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForFunction(()=>window.__modeNative.ready()&&window.__modeTest?.snapshot().editorPresent&&!window.__modeTest.snapshot().rendering);
    const api=(method,argument)=>page.evaluate(({method,argument})=>window.__modeTest[method](argument),{method,argument});
    const snapshot=()=>api('snapshot');
    const tab=async()=>page.locator('.preferences-router').getByRole('button',{name:await api('translate','editor'),exact:true}).click();
    const select=()=>page.locator('#editor-mode-preference');
    const choose=async key=>{await select().click();await page.getByRole('option',{name:await api('translate',key),exact:true}).click();};
    const idle=async mode=>page.waitForFunction(mode=>{const state=window.__modeTest.snapshot();return !state.saving&&state.preference===mode&&state.mode===mode;},mode);
    await tab();assert.equal(await select().getAttribute('aria-label'),await api('translate','editorMode'));assert.equal(await select().getAttribute('aria-describedby'),'editor-mode-hint');assert.equal((await snapshot()).preference,'wysiwyg');
    await api('edit','Changed ');const baseline=await snapshot();assert.ok(baseline.pmUndo>0);await choose('editorModeSource');await idle('source');assert.equal(await page.evaluate(()=>localStorage.getItem('editorModePreferences')),'source');assert.equal((await snapshot()).markdown,baseline.markdown);assert.equal((await snapshot()).pmUndo,baseline.pmUndo);assert.equal((await snapshot()).editRevision,baseline.editRevision);
    await api('settings',false);assert.equal(await page.locator('.source-mode-bar,.source-mode-choices,#editor-mode-preference:visible').count(),0,'the editing page has no mode control');await page.locator('[data-source-editor]').waitFor({state:'visible'});await api('settings',true);
    console.log('PASS settings-only mode selector persists and applies without changing the document or PM history');

    await page.evaluate(()=>window.__modeNative.storageFailure=true);await choose('editorModeSplit');await page.waitForFunction(()=>!!window.__modeTest.snapshot().saveError);assert.equal((await snapshot()).preference,'source');assert.equal((await snapshot()).mode,'source');assert.equal(await page.evaluate(()=>localStorage.getItem('editorModePreferences')),'source');
    assert.equal(await select().inputValue(),await api('translate','editorModeSource'),'failed selection displays the retained preference');
    await page.evaluate(()=>window.__modeNative.storageFailure=false);await page.locator('.editor-mode-settings').getByRole('button',{name:await api('translate','retry'),exact:true}).click();await idle('split');assert.equal((await snapshot()).saveError,null);
    await page.evaluate(()=>window.__modeNative.eventFailure=true);await choose('editorModeRendered');await idle('wysiwyg');assert.ok((await snapshot()).syncError);assert.equal((await snapshot()).saveError,null);assert.equal(await page.evaluate(()=>localStorage.getItem('editorModePreferences')),'wysiwyg');
    await page.evaluate(()=>window.__modeNative.eventFailure=false);await page.locator('.editor-mode-settings').getByRole('button',{name:await api('translate','retry'),exact:true}).click();await page.waitForFunction(()=>!window.__modeTest.snapshot().saving&&!window.__modeTest.snapshot().syncError);
    await page.evaluate(()=>window.__modeNative.delayEvent=true);await choose('editorModeSplit');await page.waitForFunction(()=>window.__modeTest.snapshot().saving);assert.equal(await select().isDisabled(),true);assert.equal(await page.locator('.editor-mode-settings').getAttribute('aria-busy'),'true');await page.evaluate(()=>window.__modeNative.release());await idle('split');
    console.log('PASS save failure preserves selection, Retry works, sync errors are separate and pending controls stay disabled');

    await page.reload();await page.waitForFunction(()=>window.__modeNative.ready()&&window.__modeTest?.snapshot().mode==='split');await tab();assert.equal((await snapshot()).preference,'split');
    const second=await context.newPage();second.on('pageerror',error=>errors.push(error.message));await second.goto(url+'?surface=settings');await second.waitForFunction(()=>window.__modeNative.ready()&&!!window.__modeTest);assert.equal(await second.evaluate(()=>window.__modeTest.snapshot().editorPresent),false,'a standalone settings window does not require an editor');await second.locator('.preferences-router').getByRole('button',{name:await second.evaluate(()=>window.__modeTest.translate('editor')),exact:true}).click();await second.locator('#editor-mode-preference').click();await second.getByRole('option',{name:await second.evaluate(()=>window.__modeTest.translate('editorModeSource')),exact:true}).click();await idle('source');assert.equal(await second.evaluate(()=>window.__modeTest.snapshot().preference),'source','the standalone settings window can save a mode');await second.close();
    await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','wysiwyg'));await idle('wysiwyg');const beforeInvalid=await snapshot();await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','bogus'));assert.equal((await snapshot()).requestRevision,beforeInvalid.requestRevision);assert.equal((await snapshot()).mode,'wysiwyg');
    await api('settings',false);assert.equal(await api('locateSource'),true);const temporarySourceState=await snapshot();assert.equal(temporarySourceState.mode,'source');assert.equal(temporarySourceState.preference,'wysiwyg');await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','wysiwyg'));assert.equal((await snapshot()).mode,'source','duplicate native preference events preserve a search location in temporary source mode');assert.equal((await snapshot()).requestRevision,temporarySourceState.requestRevision);await api('save','wysiwyg');await idle('wysiwyg');
    console.log('PASS duplicate broadcasts preserve temporary search source mode and explicit settings saves can reapply the preference');
    console.log('PASS reload, standalone settings persistence, cross-window storage/native events and invalid event rejection');

    await api('busy',true);await page.evaluate(async()=>{await window.__modeNative.emit('editorModePreferences','source');await window.__modeNative.emit('editorModePreferences','split');});assert.equal((await snapshot()).mode,'wysiwyg');await api('busy',false);await idle('split');
    await api('resourceBusy',true);await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','wysiwyg'));assert.equal((await snapshot()).mode,'split');await api('resourceBusy',false);await idle('wysiwyg');
    await api('searchComposing',true);await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','source'));assert.equal((await snapshot()).mode,'wysiwyg');await api('searchComposing',false);await idle('source');await api('save','wysiwyg');await idle('wysiwyg');
    await api('settings',false);const wys=page.locator('.marknote[contenteditable="true"]');await wys.dispatchEvent('compositionstart');await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','source'));assert.equal((await snapshot()).mode,'wysiwyg');await wys.dispatchEvent('compositionend');await idle('source');const field=page.locator('[data-source-editor]');await field.dispatchEvent('compositionstart');await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','split'));assert.equal((await snapshot()).mode,'source');await field.dispatchEvent('compositionend');await idle('split');
    console.log('PASS last requested mode waits for lifecycle/resource work and both rendered/source IME composition');

    await field.fill('# Source kept after preference failure\n\nChanged source');const raw=(await snapshot()).markdown;await api('failParser',true);await page.evaluate(()=>window.__modeNative.emit('editorModePreferences','wysiwyg'));await page.locator('.editor-mode-notice[role="alert"]').waitFor();assert.equal((await snapshot()).mode,'split');assert.equal((await snapshot()).markdown,raw);await api('failParser',false);await page.locator('.editor-mode-notice[role="alert"]').getByRole('button',{name:await api('translate','retry'),exact:true}).click();await idle('wysiwyg');assert.equal((await snapshot()).markdown,raw,'the production Retry action preserves source while retrying rendering');
    console.log('PASS parse failure retains source and the production error notice retries safely');

    await api('settings',true);await tab();await api('locale','zhCn');await api('theme','dark');await page.setViewportSize({width:390,height:740});await select().focus();await page.keyboard.press('ArrowDown');await page.getByRole('listbox').waitFor();assert.equal(await page.getByRole('option',{name:await api('translate','editorModeSource'),exact:true}).count(),1);assert.equal(await page.getByRole('option',{name:await api('translate','editorModeSplit'),exact:true}).count(),1);const popup=await page.getByRole('listbox').evaluate(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right};});assert.ok(popup.left>=0&&popup.right<=390,'the authored mode popup fits the narrow settings window');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForFunction(()=>!window.__modeTest.snapshot().saving);assert.equal(await select().evaluate(element=>element===document.activeElement),true,'keyboard selection retains the select focus');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    fs.mkdirSync(path.join(root,'outputs','editor-mode'),{recursive:true});await select().click();await page.getByRole('listbox').waitFor();await page.screenshot({path:path.join(root,'outputs','editor-mode','settings-chinese-dark-narrow.png')});await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__modeVueErrors||[]),[]);console.log('PASS Chinese dark/narrow settings, labeled keyboard selection, focused popup and no editor-page mode controls');console.log('editor mode browser: 7 groups passed');
  } finally {
    await browser?.close();if(server)await new Promise((resolve,reject)=>server.httpServer.close(error=>error?reject(error):resolve()));
    if(path.dirname(path.resolve(temporary))===root&&path.basename(temporary).startsWith('.editor-mode-browser-test-'))fs.rmSync(temporary,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
