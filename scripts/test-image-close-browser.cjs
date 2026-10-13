/* Real Preferences/Image/Shortcuts and their stores; native IPC is simulated. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function playwright() {
  for (const value of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(value); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required. Set MARKNOTE_PLAYWRIGHT_PATH.');
}
const harness = String.raw`<template><Preferences /></template>
<script setup>
import { nextTick } from 'vue';
import Preferences from '/src/components/Preferences.vue';
import { useImagePreferencesStore } from '/src/store/imagePreferences';
import { usePreferencesStore } from '/src/store/preferences';
import { useAppStore } from '/src/store/app';
import { findThemeByType, setTheme } from '/src/theme';
import i18n from '/src/i18n';
const image = useImagePreferencesStore(), preferences = usePreferencesStore(), app = useAppStore();
window.__imageCloseTest = {
 translate(key) { return i18n.global.t(key); },
 async locale(value) { i18n.global.locale.value = value; await nextTick(); },
 async theme(value) { app.theme = findThemeByType(value); setTheme(app.theme); await nextTick(); },
 snapshot() { return { dirty: image.dirty, path: image.path, type: image.saveType, loaded: image.loaded,
   loading: image.loading, saving: image.saving, prompt: image.closePrompt, error: image.errorKey,
   invalid: image.invalidPathKey, shortcutLoaded: preferences.shortcutsLoaded, shortcutSaving: preferences.savingShortcuts }; },
};
</script>
<style>html,body{margin:0;height:100%;overflow:hidden;}</style>`;
function nativeMock() {
  const callbacks = new Map(), listeners = new Map(); let sequence = 1;
  window.os = 'windows'; window.isTauri = true; localStorage.setItem('lang', 'en');
  const state = { calls: [], config: { image_save_type: 'default', image_save_path: '${filename}.assets' }, imageFailure: false,
    shortcutFailure: false, delayImage: false, releaseImage: null, closeFinished: false, closeRequests: 0,
    async emit(event, payload) { for (const [id, item] of listeners) if (item.event === event) await callbacks.get(item.handler)?.({event,id,payload}); },
    requestClose() { this.closeFinished = false; this.closeRequests++; this.emit('tauri://close-requested', null).finally(() => { this.closeFinished = true; }); },
  };
  window.__imageCloseNative = state;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener(event,id) { listeners.delete(id); } };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: {label:'preferences'}, currentWebview:{label:'preferences'} }, convertFileSrc(value) { return value; },
    transformCallback(callback, once=false) { const id=sequence++; callbacks.set(id,value=>{ if(once)callbacks.delete(id); return callback(value); }); return id; },
    unregisterCallback(id) { callbacks.delete(id); },
    async invoke(command,args={}) {
      state.calls.push({command,args});
      if(command==='plugin:event|listen') { const id=sequence++; listeners.set(id,{event:args.event,handler:args.handler}); return id; }
      if(command==='plugin:event|unlisten') { listeners.delete(args.eventId); return; }
      if(command==='plugin:event|emit'||command==='plugin:event|emit_to') { await state.emit(args.event,args.payload); return; }
      if(command==='get_config') return {code:0,data:{...state.config}};
      if(command==='save_image_type') {
        if(state.delayImage) { state.delayImage=false; await new Promise(resolve=>state.releaseImage=resolve); }
        if(state.imageFailure) return {code:1,info:'Injected database failure'};
        state.config.image_save_type=args.saveType; state.config.image_save_path=args.path; return {code:0};
      }
      if(command==='save_shortcut_preferences') {
        if(state.shortcutFailure) return {code:1,info:'Injected shortcut database failure'};
        state.config.shortcut_preferences=JSON.stringify(args.options); return {code:0};
      }
      if(command==='plugin:notification|is_permission_granted') return true;
      if(command==='plugin:notification|request_permission') return 'granted';
      if(command==='theme_list') return [];
      if(command.startsWith('plugin:window|')||command.startsWith('plugin:log|')||command==='log_error'||command==='log_info')return;
      throw new Error('Unexpected native command '+command);
    }
  };
}
async function main() {
  const {chromium}=playwright(), {build,preview}=await import('vite'), vue=(await import('@vitejs/plugin-vue')).default;
  const temporary=fs.mkdtempSync(path.join(root,'.image-close-browser-test-')); let server,browser;
  const errors=[];
  try {
    fs.writeFileSync(path.join(temporary,'Harness.vue'),harness);
    fs.writeFileSync(path.join(temporary,'main.js'),[
      "import {createApp} from 'vue';", "import {createPinia} from 'pinia';", "import i18n from '/src/i18n';",
      "import '/src/scss/element-plus.scss';", "import 'element-plus/theme-chalk/dark/css-vars.css';", "import '/src/styles.css';",
      "import Harness from './Harness.vue';", "createApp(Harness).use(createPinia()).use(i18n).mount('#app');",
    ].join('\n'));
    fs.writeFileSync(path.join(temporary,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:"></head><body><div id="marknote-titlbar"></div><div id="app"></div><script type="module" src="./main.js"></script></body></html>');
    const stub='\0image-close-unrelated-tabs';
    const config={root,configFile:false,logLevel:'error',plugins:[{name:'image-close-unrelated-tabs',enforce:'pre',
      resolveId(source,importer) { if(importer?.replaceAll('\\','/').endsWith('/src/components/Preferences.vue')&&/^\.\/preferences\/(Editor|Markdown|Theme)\.vue$/.test(source))return stub; },
      load(id) { if(id===stub)return "export default {template:'<div></div>'};"; }},vue()],
      build:{outDir:path.join(temporary,'dist'),emptyOutDir:true,minify:false,rollupOptions:{input:path.join(temporary,'index.html')}},
      preview:{host:'127.0.0.1',port:0,strictPort:false}};
    console.log('Building Preferences close browser harness'); await build(config); server=await preview(config);
    const url=`http://127.0.0.1:${server.httpServer.address().port}/${path.basename(temporary)}/index.html`;
    const executablePath=process.env.MARKNOTE_BROWSER_PATH||(fs.existsSync(chromium.executablePath())?chromium.executablePath():'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    browser=await chromium.launch({headless:true,executablePath});
    let page;
    const start=async()=>{
      await page?.close(); page=await browser.newPage({viewport:{width:900,height:800},reducedMotion:'reduce'});
      page.setDefaultTimeout(15000); page.on('pageerror',error=>errors.push(error.message)); await page.addInitScript(nativeMock); await page.goto(url);
      await page.waitForFunction(()=>window.__imageCloseTest?.snapshot().shortcutLoaded);
    };
    const api=(method,arg)=>page.evaluate(({method,arg})=>window.__imageCloseTest[method](arg),{method,arg});
    const label=key=>api('translate',key);
    const tab=async key=>page.locator('.preferences-router').getByRole('button',{name:await label(key),exact:true}).click();
    const imagePath=()=>page.locator('#image-save-path');
    const prepareImage=async(value='edited.assets')=>{ await tab('image'); await page.waitForFunction(()=>window.__imageCloseTest.snapshot().loaded); await imagePath().fill(value); };
    const close=()=>page.evaluate(()=>window.__imageCloseNative.requestClose());
    const finished=()=>page.waitForFunction(()=>window.__imageCloseNative.closeFinished);
    const closedCount=()=>page.evaluate(()=>window.__imageCloseNative.calls.filter(call=>call.command==='plugin:window|close').length);
    const dialog=()=>page.getByRole('dialog');
    // Element Plus uses its own locale for the close icon, independently of app locale.
    const dismissDialog=async()=>{ await page.locator('.el-message-box__headerbtn').click(); await finished(); };
    const choice=async key=>dialog().getByRole('button',{name:await label(key),exact:true}).click();

    await start(); await prepareImage(); await tab('general'); await close();
    await dialog().getByText(await label('imageUnsavedClose'),{exact:true}).waitFor();
    await close(); assert.equal(await dialog().count(),1,'Repeated native close requests must not overlap dialogs');
    await dismissDialog(); assert.equal(await closedCount(),0); assert.equal((await api('snapshot')).path,'edited.assets');
    await tab('image'); assert.equal(await imagePath().inputValue(),'edited.assets');
    console.log('PASS Image dirty close dismissal preserves typed settings across tabs and repeated close requests stay serialized');

    await page.evaluate(()=>window.__imageCloseNative.imageFailure=true); await tab('general'); await close(); await choice('saveImageSettings'); await finished();
    assert.equal(await closedCount(),0); assert.equal((await api('snapshot')).dirty,true);
    await imagePath().waitFor(); await page.getByText(await label('imagePreferencesSaveFailed'),{exact:true}).waitFor();
    assert.equal(await imagePath().inputValue(),'edited.assets');
    await page.evaluate(()=>window.__imageCloseNative.imageFailure=false);
    await page.locator('.image-preferences-error').getByRole('button',{name:await label('retry'),exact:true}).click();
    await page.waitForFunction(()=>!window.__imageCloseTest.snapshot().dirty); await close(); await finished(); assert.equal(await closedCount(),1);
    console.log('PASS Failed save on close reveals Image, preserves the dirty draft, and retries successfully before closing');

    await start(); await prepareImage('saved-on-close.assets'); await page.evaluate(()=>window.__imageCloseNative.delayImage=true); await close(); await choice('saveImageSettings');
    await page.waitForFunction(()=>window.__imageCloseTest.snapshot().saving); assert.equal(await closedCount(),0);
    await close(); assert.equal(await closedCount(),0); await page.evaluate(()=>window.__imageCloseNative.releaseImage()); await finished();
    assert.equal(await closedCount(),1); assert.equal(await page.evaluate(()=>window.__imageCloseNative.config.image_save_path),'saved-on-close.assets');
    console.log('PASS Close waits for confirmed image persistence and blocks a second close during the write');

    await start(); await prepareImage('discard-on-close.assets'); await close(); await choice('imageDiscardSettings'); await finished();
    assert.equal(await closedCount(),1); assert.equal(await page.evaluate(()=>window.__imageCloseNative.config.image_save_path),'${filename}.assets');
    console.log('PASS Explicit image discard closes without writing configuration');

    await start(); await prepareImage('two-drafts.assets'); await tab('shortcuts');
    const shortcut=page.locator('#shortcut-format-bold'); await shortcut.focus(); await shortcut.press('Control+Alt+Shift+b'); await shortcut.blur();
    await close(); await choice('imageDiscardSettings');
    await dialog().getByText(await label('shortcutUnsavedClose'),{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelectorAll('.el-message-box').length===1);
    assert.equal(await dialog().count(),1);
    await dismissDialog(); assert.equal(await closedCount(),0); assert.equal((await api('snapshot')).dirty,true);
    await tab('image'); assert.equal(await imagePath().inputValue(),'two-drafts.assets');
    await close(); await choice('saveImageSettings');
    await dialog().getByText(await label('shortcutUnsavedClose'),{exact:true}).waitFor(); await choice('shortcutSave'); await finished();
    assert.equal(await closedCount(),1);
    const writes=await page.evaluate(()=>window.__imageCloseNative.calls.filter(call=>['save_image_type','save_shortcut_preferences'].includes(call.command)).map(call=>call.command));
    assert.deepEqual(writes,['save_image_type','save_shortcut_preferences']);
    console.log('PASS Both dirty forms prompt in order; cancelling the second preserves the first draft, and confirmed saves run in sequence');

    await start(); await prepareImage(''); await tab('general'); await close(); await choice('saveImageSettings'); await finished();
    assert.equal(await closedCount(),0); await imagePath().waitFor(); assert.equal(await imagePath().getAttribute('aria-invalid'),'true');
    assert.equal(await imagePath().evaluate(element=>document.activeElement===element),true);
    console.log('PASS Invalid image configuration blocks close and focuses the visible correction field');

    await start(); await api('locale','zhCn'); await api('theme','dark'); await page.setViewportSize({width:390,height:700}); await prepareImage('中文附件');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await close(); await dialog().getByText(await label('imageUnsavedClose'),{exact:true}).waitFor();
    await page.evaluate(()=>Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    const outputs=path.join(root,'outputs'); fs.mkdirSync(outputs,{recursive:true}); await page.screenshot({path:path.join(outputs,'image-settings-close-chinese-dark.png')});
    await dismissDialog(); await api('locale','en'); await api('theme','light'); await page.setViewportSize({width:900,height:800}); await tab('image');
    await page.screenshot({path:path.join(outputs,'image-settings-english-light.png')});
    assert.deepEqual(errors,[]); console.log('Preferences/Image close browser checks passed');
  } finally {
    await browser?.close(); if(server)await new Promise(resolve=>server.httpServer.close(resolve));
    const resolved=path.resolve(temporary); if(path.dirname(resolved)===root&&path.basename(resolved).startsWith('.image-close-browser-test-'))fs.rmSync(resolved,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
