/* Production bundle smoke test. Native commands are simulated at the IPC boundary. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
function loadPlaywright() {
  for (const candidate of [process.env.MARKNOTE_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Playwright is required.');
}
function nativeMock(input) {
  const {locale,conflict=false,theme,startupArguments,expectedReadPath}=typeof input==='string'?{locale:input}:input;
  window.os='windows';window.isTauri=true;localStorage.setItem('lang',locale);
  if(theme)localStorage.setItem('theme',JSON.stringify(theme));
  const baseline={exists:true,mtimeNs:'1',size:10,hash:'1'.repeat(64)};
  const state={calls:[],draft:null,external:false,version:baseline,confirm:false,
    async mode(value){localStorage.setItem('editorModePreferences',value);for(const [id,listener] of listeners)if(listener.event==='editorModePreferences')await callbacks.get(listener.handler)?.({event:listener.event,id,payload:value});}
  };window.__nativeSmoke=state;
  let next=1;const callbacks=new Map(),listeners=new Map();
  window.__TAURI_INTERNALS__={
    metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
    transformCallback(callback,once=false){const id=next++;callbacks.set(id,value=>{if(once)callbacks.delete(id);return callback(value);});return id;},
    unregisterCallback(id){callbacks.delete(id);},convertFileSrc(value){return value;},
    async invoke(command,args={}) {
      state.calls.push({command,args});
      if(command==='plugin:event|listen'){const id=next++;listeners.set(id,{event:args.event,handler:args.handler});return id;}
      if(command.startsWith('plugin:event|'))return;
      if(command==='plugin:notification|is_permission_granted')return true;
      if(command==='cmd_args')return startupArguments??(conflict?['D:\\note.md']:[]);
      if(command==='read_md'){
        if(expectedReadPath!==undefined&&args.path!==expectedReadPath)throw new Error('File not found: '+args.path);
        return {code:0,info:args.path,data:state.external?'External disk document':'Opened document',version:state.external?{exists:true,mtimeNs:'2',size:9,hash:'2'.repeat(64)}:state.version,canonicalPath:args.path};
      }
      if(command==='probe_file_version')return {code:0,info:args.path,version:state.external?{exists:true,mtimeNs:'2',size:9,hash:'2'.repeat(64)}:state.version,canonicalPath:args.path};
      if(command==='save_md'){state.external=false;state.version={exists:true,mtimeNs:'3',size:args.md.length,hash:'3'.repeat(64)};return {code:0,info:args.path,version:state.version,canonicalPath:args.path};}
      if(command==='save_as_md')throw '';
      if(command==='plugin:dialog|message')return state.confirm?args.buttons?.OkCancelCustom?.[0]:args.buttons?.OkCancelCustom?.[1];
      if(command==='get_config')return {code:0,data:{},info:''};
      if(command==='restore_window_size'||command==='remember_window_size')return;
      if(command==='theme_list')return [];
      if(command==='draft_register')return;
      if(command==='draft_list')return [];
      if(command==='draft_write'){state.draft=args.draft;return;}
      if(command==='draft_remove'){state.draft=null;return;}
      if(command==='render_markdown')throw new Error('Browser rendering fallback');
      if(command.startsWith('plugin:window|'))return command.includes('is_')?false:undefined;
      if(command.startsWith('plugin:log|')||command.startsWith('plugin:notification|')||command.startsWith('plugin:global-shortcut|'))return;
      throw new Error('Unexpected native command: '+command);
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(_event,id){listeners.delete(id);}};
  window.Notification=class { static permission='granted';static async requestPermission(){return 'granted';} };
}
async function main() {
  const {chromium}=loadPlaywright();const {preview}=await import('vite');
  assert(fs.existsSync(path.join(root,'dist','index.html')),'Build the app before running startup checks');
  let server,browser;
  try {
    server=await preview({root,configFile:false,build:{outDir:'dist'},preview:{host:'127.0.0.1',port:0},logLevel:'error'});
    const executablePath=process.env.MARKNOTE_BROWSER_PATH||(fs.existsSync(chromium.executablePath())?undefined:['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync));
    browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
    for(const locale of ['en','zhCn']) {
      const page=await browser.newPage({viewport:{width:1100,height:740}});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(nativeMock,locale);
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
      const editor=page.locator('.marknote[contenteditable="true"]');await editor.waitFor();
      await page.waitForFunction(()=>window.__nativeSmoke.calls.some(call=>call.command==='draft_register')&&window.__nativeSmoke.calls.some(call=>call.command==='cmd_args'));
      await editor.fill('Production startup preserves edits '+locale);
      await page.waitForFunction(()=>window.__nativeSmoke.draft?.markdown.includes('Production startup preserves edits'));
      const draft=await page.evaluate(()=>window.__nativeSmoke.draft);
      const startupCommands=await page.evaluate(()=>window.__nativeSmoke.calls.map(call=>call.command));
      assert(startupCommands.indexOf('restore_window_size')>=0 && startupCommands.indexOf('restore_window_size')<startupCommands.indexOf('plugin:window|show'),'production restores dimensions before showing the window');
      assert.equal(draft.sourcePath,null);assert(draft.id&&draft.owner);assert.deepEqual(errors,[]);
      assert.equal(await page.locator('.draft-recovery-dialog').count(),0);
      console.log('PASS production startup, editor input and automatic draft snapshot in '+locale);
      assert.equal(await page.locator('.source-mode-bar,.source-mode-choices').count(),0,'editing page has no mode controls');
      await page.evaluate(()=>window.__nativeSmoke.mode('source'));
      const source=page.locator('[data-source-editor]');await source.waitFor({state:'visible'});
      await source.focus();const shiftTab=await source.evaluate(element=>{const event=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true});element.dispatchEvent(event);return event.defaultPrevented;});assert.equal(shiftTab,false,'source Shift+Tab remains native backward focus navigation');
      const raw='# Source document\n\nunique_needle and unique_needle\n\n[reference]: target.md\n';
      await source.fill(raw);await page.waitForFunction(text=>window.__nativeSmoke.draft?.markdown===text,raw);
      await page.locator('.titlebar-tool').first().click();
      const format=page.locator('.menus-level-1 > .menu-item > button').filter({hasText:locale==='en'?'Format':'格式'});
      assert.equal(await format.isDisabled(),true,'rendered formatting explains its disabled source state');
      assert.ok(await format.getAttribute('title'));await page.keyboard.press('Escape');
      assert.equal(await page.locator('.marknote-menus').count(),0);
      const view=page.locator('.menus-level-1 > .menu-item > button').filter({hasText:locale==='en'?'View':'视图'});
      await page.locator('.titlebar-tool').first().click();await view.hover();
      assert.equal(await page.getByRole('button',{name:locale==='en'?'Source':'源码',exact:true}).count(),0,'View menu does not expose the editor-mode choices');await page.keyboard.press('Escape');
      await page.evaluate(()=>window.__nativeSmoke.mode('split'));
      await page.waitForFunction(()=>document.querySelector('.source-preview-content')?.textContent.includes('Source document'));
      await source.focus();await page.keyboard.press('Control+Shift+F');
      const query=page.locator('#document-search-query');await query.waitFor({state:'visible'});await query.fill('unique_needle');
      await page.waitForFunction(()=>document.querySelectorAll('.document-search-result').length===2);
      await page.locator('#document-search-replacement').fill('replaced');await page.locator('.document-search-replace > div > button').nth(1).click();
      const replacement=page.getByRole('dialog').filter({hasText:locale==='en'?'Preview replacement':'预览替换'});await replacement.waitFor();
      assert.equal(await source.evaluate(element=>element.closest('[inert]')!==null),true,'replacement preview isolates the production background');
      await replacement.getByRole('button',{name:locale==='en'?'Confirm replacement':'确认替换',exact:true}).click();await replacement.waitFor({state:'hidden'});
      await page.waitForFunction(text=>document.querySelector('[data-source-editor]').value===text,raw.replaceAll('unique_needle','replaced'));
      await source.focus();await page.keyboard.press('Control+z');assert.equal(await source.inputValue(),raw,'production source Undo restores the complete replacement');
      await page.evaluate(()=>window.__nativeSmoke.mode('wysiwyg'));await editor.waitFor({state:'visible'});assert((await editor.textContent()).includes('unique_needle'));
      assert.deepEqual(errors,[]);console.log('PASS production mode preference events, no editing controls, disabled formatting, whole-document search, isolated preview and one Undo in '+locale);
      await page.close();
    }
    const startupFiles=[
      ['D:\\work\\EMS升级\\功能清单.md','D:\\work\\EMS升级\\功能清单.md'],
      ['D:\\我的 文档\\100% # 计划.markdown','D:\\我的 文档\\100% # 计划.markdown'],
      ['\\\\server\\共享 文档\\100% # 清单.md','\\\\server\\共享 文档\\100% # 清单.md'],
      ['notes\\本地 清单.md','notes\\本地 清单.md'],
      ['file:///D:/notes/%E4%B8%AD%E6%96%87%20%25%20%23.md','D:/notes/中文 % #.md'],
      ['file://server/share/%E4%B8%AD%E6%96%87%20%25%20%23.md','\\\\server\\share\\中文 % #.md'],
    ];
    for(const [argument,expectedPath] of startupFiles){
      const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(nativeMock,{locale:'zhCn',startupArguments:[argument],expectedReadPath:expectedPath});
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
      const editor=page.locator('.marknote[contenteditable="true"]');await editor.waitFor();
      await page.waitForFunction(()=>document.querySelector('.marknote')?.textContent==='Opened document');
      const reads=await page.evaluate(()=>window.__nativeSmoke.calls.filter(call=>call.command==='read_md'));
      assert.equal(reads.length,1);assert.equal(reads[0].args.path,expectedPath,'startup reads the original file path once');
      assert.equal(await page.locator('.document-notice').count(),0,'successful association opens have no failure notice');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('recent'))[0]),expectedPath);
      await editor.fill('Association document edited');
      await page.waitForFunction(()=>window.__nativeSmoke.draft?.markdown==='Association document edited');
      await page.keyboard.press('Control+s');
      await page.waitForFunction(()=>window.__nativeSmoke.calls.some(call=>call.command==='save_md'));
      const saved=await page.evaluate(()=>window.__nativeSmoke.calls.find(call=>call.command==='save_md').args);
      assert.equal(saved.path,expectedPath,'saving after an association open targets the same file');
      assert.equal(saved.md,'Association document edited');assert.equal(saved.expectedVersion.hash,'1'.repeat(64));
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('PASS production association startup and subsequent save preserve Chinese, spaces, %, #, UNC, relative paths and file URLs');
    const ts=require('typescript');const compiled=ts.transpileModule(fs.readFileSync(path.join(root,'src/theme/style/dark.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const loaded={exports:{}};new Function('exports',compiled)(loaded.exports);const dark=loaded.exports.default;
    fs.mkdirSync(path.join(root,'outputs'),{recursive:true});
    for(const locale of ['en','zhCn']) {
      const page=await browser.newPage({viewport:{width:locale==='zhCn'?390:1100,height:740}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(nativeMock,{locale,conflict:true,theme:locale==='zhCn'?dark:undefined});
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);const editor=page.locator('.marknote[contenteditable="true"]');await editor.waitFor();
      await page.waitForFunction(()=>window.__nativeSmoke.calls.some(call=>call.command==='read_md'));await editor.fill('Keep my editor changes');await page.waitForFunction(()=>window.__nativeSmoke.draft?.markdown.includes('Keep my editor changes'));
      await page.evaluate(()=>window.__nativeSmoke.external=true);const notice=page.locator('.document-notice');await notice.waitFor();assert.equal(await notice.getByRole('button').count(),4);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'conflict notice fits narrow windows');
      await page.screenshot({path:path.join(root,'outputs',locale==='zhCn'?'file-conflict-chinese-dark.png':'file-conflict-english.png')});
      await notice.getByRole('button').nth(0).click();const comparison=page.locator('.file-comparison-dialog');await comparison.waitFor();
      await comparison.locator('.file-comparison-table').waitFor();assert((await comparison.textContent()).includes('Keep my editor changes'));assert((await comparison.textContent()).includes('External disk document'));
      assert.equal(await editor.evaluate(element=>element.closest('[inert]')!==null),true,'comparison isolates the production background');
      assert.equal(await page.evaluate(()=>window.__nativeSmoke.calls.some(call=>call.command==='save_md')),false,'review is read-only');
      await page.keyboard.press('Escape');await comparison.waitFor({state:'hidden'});assert.equal(await notice.isVisible(),true);
      await notice.getByRole('button').nth(1).click();await page.waitForFunction(()=>window.__nativeSmoke.calls.some(call=>call.command==='plugin:dialog|message'));await editor.waitFor();assert.equal(await editor.textContent(),'Keep my editor changes');assert.equal(await notice.isVisible(),true,'cancelled reload retains conflict and current content');
      await notice.getByRole('button').nth(2).click();await page.waitForFunction(()=>window.__nativeSmoke.calls.some(call=>call.command==='save_as_md'));await editor.waitFor();assert.equal(await notice.isVisible(),true,'cancelled Save As retains conflict');
      await page.evaluate(()=>window.__nativeSmoke.confirm=true);await notice.getByRole('button').nth(3).click();await notice.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>window.__nativeSmoke.calls.find(call=>call.command==='save_md').args.expectedVersion.hash),'2'.repeat(64),'confirmed overwrite uses the observed disk version');
      assert.equal(await editor.textContent(),'Keep my editor changes');assert.equal(await page.evaluate(()=>window.__nativeSmoke.draft),null);assert.deepEqual(errors,[]);console.log('PASS production conflict notice: locale, narrow layout, cancelled reload/Save As, confirmed CAS and draft cleanup in '+locale);await page.close();
    }
  } finally { await browser?.close();await new Promise(resolve=>server?server.httpServer.close(resolve):resolve()); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
