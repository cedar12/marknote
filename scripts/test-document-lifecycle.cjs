const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createPinia, setActivePinia } = require('pinia');

function load(relativePath, imports = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', source)(module.exports,
    name => Object.hasOwn(imports, name) ? imports[name] : require(name), module);
  return module.exports;
}

global.localStorage = { getItem: () => null, setItem() {} };
global.window = { os: 'windows', addEventListener() {}, matchMedia: () => ({ matches: false }) };
global.document = { documentElement: { style: { setProperty() {} } } };
const lifecycle = load('src/utils/documentLifecycle.ts', {
  '@tauri-apps/api/event': {}, '@tauri-apps/api/window': {},
});
const fileVersion = load('src/utils/fileVersion.ts');
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function network(initialLabels = ['main', 'window_1', 'preferences', 'about']) {
  const requests = new Map();
  const responses = new Map();
  const log = [];
  const bus = { labels: initialLabels, drop: () => false, labelsRead: 0, onLabels() {}, controllers: [] };
  function client(label, config = {}) {
    const state = { locked: null, approvedRevision: null, revision: 0, busy: false, decision: true, releases: 0, resumed: null };
    const failures = [];
    const controller = lifecycle.createDocumentLifecycle({
      label,
      getWindowLabels: async () => { bus.onLabels(++bus.labelsRead); return [...bus.labels]; },
      onRequest: async handler => { requests.set(label, handler); return () => requests.delete(label); },
      onResponse: async handler => { responses.set(label, handler); return () => responses.delete(label); },
      sendRequest: async (target, request) => {
        log.push({ target, ...request });
        if (!bus.drop(target, request)) requests.get(target)?.(request);
      },
      sendResponse: async (target, response) => { responses.get(target)?.(response); },
    }, {
      async prepare(id) {
        if (state.busy) return { allowed: false, reason: 'busy' };
        state.locked = id;
        if (config.prepare) await config.prepare(state);
        state.approvedRevision = state.revision;
        return { allowed: state.decision, reason: 'cancelled' };
      },
      validate: id => state.locked === id && state.approvedRevision === state.revision && !state.busy,
      release(id, resume) { if (state.locked === id) { state.locked = null; state.releases += 1; state.resumed = resume; } },
    }, { requestTimeoutMs: 80, leaseMs: 200, onFailure: reason => failures.push(reason), ...config.options });
    bus.controllers.push(controller);
    return { controller, state, failures };
  }
  return { bus, log, client, responses, requests, dispose: () => bus.controllers.forEach(controller => controller.dispose()) };
}

function appFixture() {
  setActivePinia(createPinia());
  const control = { decision: 'save', write: async () => ({ code: 0 }), clear: true, clears: 0, captures: 0, writes: 0, pickers: 0,
    args: async () => [], listeners: new Map(), lifecycleStarted: 0, closeHandler: null, dragHandler: null,
    imageSave: async () => ({ code: 0, info: 'image.png' }), dispatches: 0, destroyed: 0,
    destroy: async () => {}, picker: async () => ({ code: 0, info: 'D:\\copy.md' }), captureForces: [],
    markdown: '# draft', read: async path => ({ code:0, info:path, data:'# opened' }),
    rememberSize: async () => {}, sizeWrites: 0, restoreSize: async () => {}, restores: 0, shown: 0,
    probe: async () => ({code:1}), render: async () => {}, attachmentMapping: {}, titles: [] };
  const locale = { value: 'en' };
  const nativeWindow = {
    label: 'main', setTitle: async title => {control.titles.push(title);}, show: async () => {control.shown++;},
    destroy: async () => { control.destroyed += 1; await control.destroy(); },
    listen: async () => () => {},
    onCloseRequested: async handler => { control.closeHandler = handler; return () => {}; },
    onDragDropEvent: async handler => { control.dragHandler = handler; return () => {}; },
  };
  const transactionListeners = new Set();
  const bookmark = { map() { return this; }, resolve: () => ({ from: 7 }) };
  const editor = {
    isEditable: true, edits: [], setEditable(value, emitUpdate) { this.isEditable = value; this.edits.push([value, emitUpdate]); },
    state: { markdown:control.markdown, doc: {}, selection: { getBookmark: () => bookmark }, tr: { insert: () => ({ mapping: {} }) } },
    reactiveState: {value:null},
    schema: { nodes: { image: { create: attrs => attrs } } },
    view: { updateState(state) { editor.state=state; control.markdown=state.markdown; },
      dispatch(transaction) { control.dispatches += 1; for (const handler of transactionListeners) handler({ transaction }); } },
    on(_event, handler) { transactionListeners.add(handler); },
    off(_event, handler) { transactionListeners.delete(handler); },
  };
  const editorStore = { editor, loading: false, renderingDocument: false, segmentLoading: false, navigatingToHeading: false,
    renderVersion: 0, segments: [], headings: [], segmentHeadings: [], getMarkdown: () => control.markdown, focus() {},
    async setContent(markdown) {
      this.renderVersion+=1; this.renderingDocument=true; await control.render(markdown);
      control.markdown=markdown; editor.state={...editor.state,markdown,doc:{}}; this.renderingDocument=false;
    },
    setAttachmentMapping(mapping) { control.attachmentMapping={...mapping}; },
    $patch(state) { Object.assign(this,state); },
    get $state() { return {loading:this.loading,renderingDocument:this.renderingDocument,segmentLoading:this.segmentLoading,
      renderVersion:this.renderVersion,segments:this.segments,headings:this.headings,segmentHeadings:this.segmentHeadings}; },
  };
  const { useAppStore } = load('src/store/app.ts', {
    '@tauri-apps/api/event': { emit: async () => {}, listen: async (event, handler) => {
      control.listeners.set(event, handler); return () => control.listeners.delete(event);
    }, TauriEvent: { WINDOW_FOCUS: 'focus', WINDOW_THEME_CHANGED: 'themeChanged' } },
    '@tauri-apps/api/window': { getCurrentWindow: () => nativeWindow },
    './editor': { useEditorStore: () => editorStore },
    './preferences': { usePreferencesStore: () => ({
      shortcuts: {}, applyEditorFont() {}, loadShortcutPreferences: async () => {},
      loadMarkdownPreferences: async () => {},
    }) },
    '../utils/editorFont': { readEditorFont: () => ({}) },
    '../utils/keyBinding': { KeyBindingBuilder: class { update() {} } },
    '../utils/shortcutPreferences': { SHORTCUT_PREFERENCES_EVENT: 'shortcuts' },
    '../utils/sidebarPreferences': load('src/utils/sidebarPreferences.ts'),
    '../utils/folderNavigation': load('src/utils/folderNavigation.ts'),
    '../api/window': { restoreWindowSize: async () => { control.restores++;await control.restoreSize(); }, rememberWindowSize: async () => { control.sizeWrites++; await control.rememberSize(); } },
    '../utils': { isImage: value => /\.png$/i.test(value) },
    '../api/file': { save: (...args) => { control.writes += 1; return control.write(...args); },
      saveImagePath: (...args) => control.imageSave(...args),read: (...args)=>control.read(...args),
      probeFileVersion: (...args)=>control.probe(...args) },
    '../api/dialog': { saveAs: async () => { control.pickers += 1; return control.picker(); } },
    '@tauri-apps/plugin-notification': { isPermissionGranted: async () => true },
    '@tauri-apps/plugin-dialog': { message: async (_text, options) => options?.buttons ? await control.decision : 'Ok',
      ask: async ()=>control.approve!==false },
    '../i18n': { default: { global: { t: key => key, locale } } },
    '../theme': { default: [], findThemeByType: () => undefined, isThemeItem: () => false, refreshThemeCatalog: async () => [] },
    '../api/utils': { args: () => control.args() },
    '@tauri-apps/plugin-log': { error: async () => {}, warn: async () => {} },
    '../utils/documentLifecycle': { ...lifecycle, createNativeDocumentLifecycle: () => ({
      start: async () => { await tick(); control.lifecycleStarted += 1; },
      run: async (action,beforeValidation) => { await beforeValidation?.(); await action(); return true; },
    }) },
    '../utils/fileVersion': fileVersion,
    './drafts': { useDraftsStore: () => ({
      clearCurrent: async () => { control.clears += 1; return control.clear; },
      capture: async force => { control.captures += 1; control.captureForces.push(force); },
    }) },
  });
  const app = useAppStore();
  app.loading = false;
  app.filepath = 'D:\\note.md';
  return { app, control, editor, editorStore, locale, transactionListeners };
}

async function run() {
  assert.equal(lifecycle.isDocumentWindow('main'), true);
  assert.equal(lifecycle.isDocumentWindow('window_12'), true);
  assert.equal(lifecycle.isDocumentWindow('preferences'), false);
  assert.equal(lifecycle.isDocumentWindow('about'), false);
  {
    const {app,control}=appFixture();const restoring=deferred();control.restoreSize=()=>restoring.promise;
    const startup=app.init();await tick();assert.equal(control.restores,1);assert.equal(control.shown,0,'window stays hidden until geometry restoration completes');
    restoring.resolve();await startup;assert.equal(control.shown,1);
  }
  {
    const net=network();const first=net.client('main'),second=net.client('window_1');
    await Promise.all([first.controller.start(),second.controller.start()]);
    let actionCount=0,stored=0;
    assert.equal(await first.controller.run(async()=>{actionCount++;},async()=>{
      assert.ok(first.state.locked && second.state.locked, 'all windows are protected before preference persistence');
      stored++; second.state.revision++;
    }),false);
    assert.equal(stored,1);assert.equal(actionCount,0,'all documents are revalidated after asynchronous preference persistence');
    assert.equal(first.state.locked,null);assert.equal(second.state.locked,null);net.dispose();
  }
  {
    const {app,control,editor}=appFixture();await app.init();await tick();app.isSave=true;
    const size=deferred();control.rememberSize=()=>size.promise;
    const closing=control.closeHandler({preventDefault(){}});await tick();
    assert.equal(control.sizeWrites,1);assert.equal(control.destroyed,0,'close waits for the final window dimensions');
    assert.equal(editor.isEditable,false);size.resolve();await closing;
    assert.equal(control.destroyed,1);assert.equal(app.lifecycleBusy,false);
  }
  {
    const {app,control,editor}=appFixture();await app.init();await tick();app.isSave=true;
    const size=deferred();control.rememberSize=()=>size.promise;
    const closing=control.closeHandler({preventDefault(){}});await tick();app.markEdited();size.resolve();await closing;
    assert.equal(control.destroyed,0,'edits during preference persistence cancel close');
    assert.equal(app.lifecycleBusy,false);assert.equal(editor.isEditable,true);
  }
  {
    const {app,control}=appFixture();await app.init();await tick();app.isSave=true;
    control.rememberSize=async()=>{throw new Error('preferences unavailable');};
    await control.closeHandler({preventDefault(){}});assert.equal(control.destroyed,1,'size storage failure does not block a safe close');
  }
  {
    const {app,control}=appFixture();await app.init();await tick();app.markEdited();control.decision='cancel';
    await control.closeHandler({preventDefault(){}});assert.equal(control.sizeWrites,0,'cancelled close does not save a closing-window preference');
    assert.equal(control.destroyed,0);
  }
  {
    const {app,control}=appFixture();const order=[];control.rememberSize=async()=>{order.push('size');};
    assert.equal(await app.runApplicationAction(async()=>{order.push('quit');}),true);assert.deepEqual(order,['size','quit']);
  }

  {
    const net = network();
    const first = net.client('main');
    const second = net.client('window_1');
    await Promise.all([first.controller.start(), second.controller.start()]);
    let exits = 0;
    assert.equal(await first.controller.run(async () => {
      assert.ok(first.state.locked && second.state.locked, 'all documents remain frozen until the protected action completes');
      exits += 1;
    }), true);
    assert.equal(exits, 1);
    assert.equal(first.state.locked, null);
    assert.equal(second.state.locked, null);
    assert.equal(first.state.resumed, false, 'committed exit does not recreate explicitly discarded recovery drafts');
    assert.deepEqual(net.log.filter(item => item.phase === 'prepare').map(item => item.target), ['main', 'window_1']);
    assert.ok(!net.log.some(item => ['preferences', 'about'].includes(item.target)));
    net.dispose();
  }
  for (const busy of [false, true]) {
    const net = network();
    const first = net.client('main');
    const second = net.client('window_1');
    second.state.decision = false;
    second.state.busy = busy;
    await Promise.all([first.controller.start(), second.controller.start()]);
    let exits = 0;
    assert.equal(await first.controller.run(async () => { exits += 1; }), false);
    assert.equal(exits, 0, 'a cancellation or busy export in any window blocks the application action');
    assert.equal(first.state.locked, null);
    assert.equal(second.state.locked, null);
    assert.equal(first.state.resumed, true, 'cancellation restores recovery protection for previously approved windows');
    assert.deepEqual(first.failures, busy ? ['busy'] : [], 'user cancellation is silent');
    net.dispose();
  }
  {
    const net = network();
    const first = net.client('main');
    const second = net.client('window_1', { prepare: async () => { first.state.revision += 1; } });
    await Promise.all([first.controller.start(), second.controller.start()]);
    assert.equal(await first.controller.run(async () => assert.fail('newer edits cannot be lost')), false);
    assert.deepEqual(first.failures, ['changed']);
    assert.equal(first.state.locked, null);
    net.dispose();
  }
  {
    const net = network();
    const first = net.client('main');
    const second = net.client('window_1');
    net.bus.onLabels = count => { if (count === 2) net.bus.labels.push('window_2'); };
    await Promise.all([first.controller.start(), second.controller.start()]);
    assert.equal(await first.controller.run(async () => assert.fail('a newly created window needs its own approval')), false);
    assert.deepEqual(first.failures, ['changed']);
    assert.equal(second.state.locked, null);
    net.dispose();
  }
  {
    const net = network();
    const first = net.client('main');
    await first.controller.start();
    // A forged/duplicate acknowledgement for another label does not approve the missing window.
    net.bus.drop = (target, request) => {
      if (target === 'window_1' && request.phase === 'prepare') {
        net.responses.get('main')({ id: request.id, label: 'main', phase: 'prepare', allowed: true });
      }
      return false;
    };
    assert.equal(await first.controller.run(async () => assert.fail('missing acknowledgements fail closed')), false);
    assert.deepEqual(first.failures, ['timeout']);
    assert.equal(first.state.locked, null);
    // The next request works; a timeout does not leave the coordinator permanently busy.
    const second = net.client('window_1');
    await second.controller.start();
    assert.equal(await first.controller.run(async () => {}), true);
    net.dispose();
  }
  {
    const net = network();
    const first = net.client('main');
    const second = net.client('window_1');
    await Promise.all([first.controller.start(), second.controller.start()]);
    await assert.rejects(first.controller.run(async () => { throw new Error('native action failed'); }), /native action failed/);
    assert.equal(first.state.locked, null);
    assert.equal(second.state.locked, null);
    assert.equal(await first.controller.run(async () => {}), true);
    net.dispose();
  }
  {
    const net = network();
    const first = net.client('main');
    const second = net.client('window_1');
    await Promise.all([first.controller.start(), second.controller.start()]);
    let exits = 0;
    const results = await Promise.all([first.controller.run(async () => { exits += 1; }), second.controller.run(async () => { exits += 1; })]);
    assert.ok(exits <= 1, 'simultaneous quit requests cannot both commit');
    assert.ok(results.some(result => !result));
    assert.equal(first.state.locked, null);
    assert.equal(second.state.locked, null);
    net.dispose();
  }
  {
    const net = network(['main', 'window_1']);
    const second = net.client('window_1', { options: { leaseMs: 25 } });
    await second.controller.start();
    net.requests.get('window_1')({ id: 'crashed-owner', owner: 'main', phase: 'prepare' });
    await tick();
    assert.equal(second.state.locked, 'crashed-owner');
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(second.state.locked, null, 'a crashed initiating window releases peer editability through the lease');
    net.dispose();
  }

  {
    const events = [];
    const update = { download: async () => events.push('download'), install: async () => events.push('install') };
    assert.equal(await lifecycle.installUpdateSafely(update, async action => { events.push('protect'); await action(); return true; }, async () => events.push('restart')), true);
    assert.deepEqual(events, ['download', 'protect', 'install', 'restart']);
    events.length = 0;
    assert.equal(await lifecycle.installUpdateSafely(update, async () => { events.push('cancel'); return false; }, async () => events.push('restart')), false);
    assert.deepEqual(events, ['download', 'cancel'], 'cancellation after download prevents installation and restart');
    await assert.rejects(lifecycle.installUpdateSafely({ download: async () => { throw Error('download failed'); }, install: async () => assert.fail() }, async () => assert.fail(), async () => assert.fail()), /download failed/);
  }

  {
    const { app, control, locale } = appFixture();
    const startup = deferred();
    control.args = () => startup.promise;
    app.loading = true;
    // Calling init outside component setup, including its first awaited registration,
    // must not attempt a Vue useI18n injection after the await boundary.
    await app.init();
    assert.equal(control.lifecycleStarted, 1);
    assert.equal(app.loading, true, 'recovery and document transitions wait for startup file arguments');
    assert.equal(await app.guardUnsavedChanges(), false);
    assert.equal(typeof control.closeHandler, 'function');
    control.listeners.get('language')({ payload: 'zhCn' });
    assert.equal(locale.value, 'zhCn', 'native language events update the global locale after async startup');
    startup.resolve([]);
    await tick();
    assert.equal(app.loading, false);
    assert.equal(await app.guardUnsavedChanges(), true);
    for (const field of ['exporting', 'resourceTasks']) {
      app[field] = field === 'resourceTasks' ? 1 : true;
      let prevented = false;
      await control.closeHandler({ preventDefault() { prevented = true; } });
      assert.equal(prevented, true, 'native close is blocked during exports and resource tasks');
      app[field] = field === 'resourceTasks' ? 0 : false;
    }
  }
  {
    const { app, control, editor } = appFixture();
    await app.init();
    await tick();
    app.draftCleanupPending = true;
    const cleanup = deferred();
    control.clear = cleanup.promise;
    let prevented = false;
    const closing = control.closeHandler({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true, 'native close is prevented before any asynchronous cleanup begins');
    assert.equal(app.lifecycleBusy, true);
    assert.equal(editor.isEditable, false, 'a saved document is frozen while delayed recovery cleanup is pending');
    await tick();
    app.markEdited();
    cleanup.resolve(true);
    await closing;
    await tick();
    assert.equal(control.destroyed, 0, 'edits arriving during saved-document cleanup prevent explicit destroy');
    assert.equal(app.isSave, false);
    assert.equal(app.lifecycleBusy, false);
    assert.equal(editor.isEditable, true);
    assert.ok(control.captureForces.includes(true), 'failed close force-restores draft protection after explicit cleanup');
  }
  {
    const { app, control, editor } = appFixture();
    await app.init();
    await tick();
    app.filepath = null;
    app.markEdited();
    const picker = deferred();
    control.picker = () => picker.promise;
    const closing = control.closeHandler({ preventDefault() {} });
    await tick();
    assert.equal(control.pickers, 1);
    assert.equal(editor.isEditable, false, 'Save As cannot leave a closing document editable');
    app.markEdited();
    picker.resolve({ code: 0, info: 'D:\\saved-copy.md' });
    await closing;
    await tick();
    assert.equal(control.destroyed, 0);
    assert.equal(app.isSave, false);
    assert.equal(app.filepath, 'D:\\saved-copy.md');
    assert.equal(editor.isEditable, true);
    assert.ok(control.captureForces.includes(true));
  }
  {
    const { app, control, editor } = appFixture();
    await app.init();
    await tick();
    app.markEdited();
    control.decision = 'giveUp';
    const destroying = deferred();
    control.destroy = () => destroying.promise;
    const closing = control.closeHandler({ preventDefault() {} });
    await tick();
    assert.equal(control.destroyed, 1);
    assert.equal(app.lifecycleBusy, true);
    assert.equal(editor.isEditable, false, 'read-only protection remains until native destroy finishes');
    assert.equal(await app.save(), false);
    await control.closeHandler({ preventDefault() {} });
    assert.equal(control.destroyed, 1, 'duplicate close events cannot destroy or approve twice');
    destroying.resolve();
    await closing;
    await tick();
    assert.equal(control.captures, 0, 'successful explicit discard does not recreate a draft during committed close');
    assert.equal(app.lifecycleBusy, false);
  }
  {
    const { app, control, editor } = appFixture();
    await app.init();
    await tick();
    app.markEdited();
    control.decision = 'giveUp';
    control.destroy = async () => { throw new Error('destroy failed'); };
    await control.closeHandler({ preventDefault() {} });
    await tick();
    assert.equal(app.lifecycleBusy, false);
    assert.equal(editor.isEditable, true);
    assert.equal(app.isSave, false);
    assert.ok(control.captureForces.includes(true), 'native destroy failure restores the discarded recovery snapshot');
  }
  {
    const { app, control } = appFixture();
    await app.init();
    await tick();
    app.markEdited();
    const writing = deferred();
    control.write = () => writing.promise;
    let prevented = false;
    const closing = control.closeHandler({ preventDefault() { prevented = true; } });
    await tick();
    app.markEdited();
    writing.resolve({ code: 0 });
    await closing;
    assert.equal(prevented, true, 'native close preserves edits made while its save was in progress');
    assert.equal(app.isSave, false);
  }
  {
    const { app, control, editorStore, transactionListeners } = appFixture();
    await app.init();
    await tick();
    const savingImage = deferred();
    control.imageSave = () => savingImage.promise;
    const dropping = control.dragHandler({ payload: { type: 'drop', paths: ['one.png'] } });
    assert.equal(app.resourceTasks, 1, 'dragged images remain busy until their asynchronous writes and insertion finish');
    assert.equal((await app.prepareApplicationAction('image-pending')).allowed, false);
    editorStore.renderVersion += 1;
    savingImage.resolve({ code: 0, info: 'image.png' });
    await dropping;
    assert.equal(control.dispatches, 0, 'image writes cannot insert into a replaced document or segment');
    assert.equal(app.resourceTasks, 0);
    assert.equal(transactionListeners.size, 0);
    editorStore.segmented = true;
    control.imageSave = async () => ({ code: 0, info: 'next.png' });
    await control.dragHandler({ payload: { type: 'drop', paths: ['next.png'] } });
    assert.equal(control.dispatches, 1, 'images can be dropped into the current large-file segment');
    assert.equal(app.resourceTasks, 0);
  }
  {
    const { app, control } = appFixture();
    const writing = deferred();
    control.write = () => writing.promise;
    const saving = app.save();
    app.markEdited();
    writing.resolve({ code: 0 });
    assert.equal(await saving, true, 'a successful disk write remains a successful write');
    assert.equal(app.isSave, false, 'newer edits remain dirty');
    assert.equal(control.clears, 0, 'a recovery snapshot for newer edits is retained');
  }
  {
    const { app, control } = appFixture();
    const cleanup = deferred();
    control.clear = cleanup.promise;
    const saving = app.save();
    await tick();
    app.markEdited();
    cleanup.resolve(true);
    assert.equal(await saving, true);
    await tick();
    assert.equal(app.isSave, false);
    assert.equal(control.captures, 1, 'edits during recovery cleanup regain a snapshot after the saved draft is deleted');
  }
  {
    const { app, control } = appFixture();
    const writing = deferred();
    control.write = () => writing.promise;
    const leaving = app.guardUnsavedChanges();
    await tick();
    assert.equal(control.writes, 1);
    app.markEdited();
    writing.resolve({ code: 0 });
    assert.equal(await leaving, false, 'edits made during a guarded save prevent navigation or exit');
    assert.equal(control.clears, 0);
  }
  {
    const { app, control } = appFixture();
    const confirmation = deferred();
    control.decision = confirmation.promise;
    const leaving = app.guardUnsavedChanges();
    await tick();
    app.markEdited();
    confirmation.resolve('giveUp');
    assert.equal(await leaving, false, 'discard approval cannot cover an edit made after the prompt opened');
    assert.equal(control.clears, 0);
  }
  {
    const { app, control } = appFixture();
    control.decision = 'cancel';
    assert.equal(await app.guardUnsavedChanges(), false);
    assert.equal(control.writes, 0);
    assert.equal(control.clears, 0);
    control.decision = 'giveUp';
    control.clear = false;
    assert.equal(await app.guardUnsavedChanges(), false, 'failed draft cleanup blocks explicit discard');
    assert.equal(app.draftCleanupPending, true);
  }
  {
    const { app, control } = appFixture();
    control.clear = false;
    assert.equal(await app.save(), true);
    assert.equal(app.isSave, true);
    assert.equal(app.saveError, null, 'recovery cleanup is not misreported as a file write failure');
    assert.equal(app.draftCleanupPending, true);
    assert.equal(await app.guardUnsavedChanges(), false);
    control.clear = true;
    assert.equal(await app.guardUnsavedChanges(), true);
    assert.equal(app.draftCleanupPending, false);
  }
  {
    const { app, control } = appFixture();
    const writing = deferred();
    control.write = () => writing.promise;
    const saving = app.save();
    const savingAs = app.save(true);
    writing.resolve({ code: 0 });
    assert.equal(await saving, true);
    assert.equal(await savingAs, true);
    assert.equal(control.pickers, 1, 'Save As cannot disappear behind another successful save');
  }
  {
    const { app, editor } = appFixture();
    app.isSave = true;
    assert.deepEqual(await app.prepareApplicationAction('request'), { allowed: true });
    assert.equal(editor.isEditable, false);
    assert.deepEqual(editor.edits, [[false, false]], 'freezing the editor does not dispatch an update');
    assert.equal(await app.guardUnsavedChanges(), false);
    assert.equal(await app.save(), false);
    assert.equal(app.validateApplicationAction('request'), true);
    app.markEdited();
    assert.equal(app.validateApplicationAction('request'), false);
    app.releaseApplicationAction('other-request');
    assert.equal(app.lifecycleBusy, true, 'a different request cannot release another request lock');
    app.releaseApplicationAction('request');
    assert.equal(editor.isEditable, true);
    assert.equal(app.lifecycleBusy, false);
  }
  {
    const { app, control } = appFixture();
    control.decision = 'giveUp';
    assert.equal((await app.prepareApplicationAction('discarded')).allowed, true);
    assert.equal(control.clears, 1);
    app.releaseApplicationAction('discarded', true);
    await tick();
    assert.equal(control.captures, 1, 'another window cancelling exit restores this dirty document recovery snapshot');
  }
  {
    const { app, control } = appFixture();
    control.decision = 'giveUp';
    assert.equal((await app.prepareApplicationAction('committed')).allowed, true);
    app.releaseApplicationAction('committed', false);
    await tick();
    assert.equal(control.captures, 0, 'successful discard and exit keeps the recovery draft deleted');
  }
  {
    const { app, control, editor } = appFixture();
    const confirmation = deferred();
    control.decision = confirmation.promise;
    const preparing = app.prepareApplicationAction('abandoned');
    await tick();
    app.releaseApplicationAction('abandoned');
    confirmation.resolve('save');
    assert.equal((await preparing).allowed, false);
    assert.equal(control.writes, 0, 'a late answer cannot restart a timed-out lifecycle request');
    assert.equal(editor.isEditable, true);
  }
  for (const field of ['exporting', 'resourceTasks']) {
    const { app, editor } = appFixture();
    app.isSave = true;
    app[field] = field === 'resourceTasks' ? 1 : true;
    assert.equal((await app.prepareApplicationAction('busy')).allowed, false);
    assert.equal(app.lifecycleBusy, false);
    assert.equal(editor.isEditable, true);
  }
  {
    const { app, editorStore } = appFixture();
    app.isSave = true;
    editorStore.segmentLoading = true;
    assert.equal(await app.guardUnsavedChanges(), false);
    assert.equal((await app.prepareApplicationAction('segment-loading')).allowed, false);
    editorStore.segmentLoading = false;
    assert.equal((await app.prepareApplicationAction('segment-ready')).allowed, true);
    editorStore.segmentLoading = true;
    assert.equal(app.validateApplicationAction('segment-ready'), false);
    app.releaseApplicationAction('segment-ready');
  }
  {
    const { app, editorStore, control } = appFixture();
    editorStore.sourceComposing = true;
    assert.equal(await app.save(), false, 'an unfinished source IME composition cannot be saved');
    assert.equal(await app.openMarkdownDocument('D:\\next.md'), 'cancelled');
    assert.equal(await app.guardUnsavedChanges(), false);
    assert.equal((await app.prepareApplicationAction('source-composing')).allowed, false);
    assert.equal(control.writes, 0);
    assert.equal(control.pickers, 0);
    assert.equal(app.lifecycleBusy, false);
    editorStore.sourceComposing = false;
    app.isSave = true;
    assert.equal((await app.prepareApplicationAction('source-ready')).allowed, true);
    editorStore.sourceComposing = true;
    assert.equal(app.validateApplicationAction('source-ready'), false);
    app.releaseApplicationAction('source-ready');
  }
  console.log('Document lifecycle tests passed: multi-window approvals, cancellation, revision checks, leases, updates, and recovery cleanup.');
}

module.exports={appFixture,load,deferred,tick,fileVersion};
if(require.main===module)run().catch(error => { console.error(error); process.exitCode = 1; });
