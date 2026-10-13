import { defineStore } from 'pinia';
import { nextTick, watch, type Ref, type WatchStopHandle } from 'vue';
import { createDraftRepository } from '../api/drafts';
import { draftByteLength, summarizeDraft, DRAFT_MAX_BYTES, type DraftRepository, type DraftSnapshot, type DraftSummary } from '../utils/draftRecovery';
import { useAppStore } from './app';
import { useEditorStore } from './editor';

const WRITE_DELAY_MS = 450;
let repository: DraftRepository | undefined;
let owner = '';
let currentId: string | null = null;
let sourcePath: string | null = null;
let sourceTitle = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let scanTimer: ReturnType<typeof setInterval> | undefined;
let queue: Promise<void> = Promise.resolve();
let generation = 0;
let composing = false;
let restoring = false;
let clearing = false;
let stops: WatchStopHandle[] = [];
let retryOperation: (() => Promise<unknown>) | undefined;
let autoOpened = false;
const pendingClaims = new Map<string, DraftSummary>();
let clearedDocument: { revision: number; renderVersion: number } | null = null;

export const useDraftsStore = defineStore('drafts', {
  state: () => ({
    initialized: false,
    registered: false,
    visible: false,
    pending: false,
    saving: false,
    errorKey: null as string | null,
    recoverable: [] as DraftSummary[],
    selectedId: null as string | null,
    recoveredSource: null as string | null,
    resourceSourcePath: null as string | null,
    savedAt: null as number | null,
    discardingId: null as string | null,
  }),
  actions: {
    async init() {
      if (this.initialized) return;
      this.initialized = true;
      try {
        repository = createDraftRepository();
        owner = crypto.randomUUID();
      } catch {
        this.initialized = false;
        this.fail('draftLoadFailed', () => this.init());
        return;
      }
      const app = useAppStore();
      const editor = useEditorStore();
      stops.push(watch(() => [app.editRevision, editor.renderingDocument, editor.loading, editor.segmentLoading, editor.sourceComposing], () => {
        if (!app.isSave && !restoring) this.schedule();
      }, { flush: 'post' }));
      stops.push(watch(() => [app.loading, editor.loading, editor.renderingDocument, editor.segmentLoading, editor.sourceComposing, Boolean(editor.editor)], () => {
        this.offerRecovery();
      }, { flush: 'post' }));
      stops.push(editor.$onAction(({ name, after }) => {
        if (name !== 'setContent' || restoring) return;
        after(() => {
          this.resourceSourcePath = null;
          this.recoveredSource = null;
          sourcePath = app.filepath;
          sourceTitle = app.title || '';
        });
      }));
      document.addEventListener('compositionstart', this.compositionStart);
      document.addEventListener('compositionend', this.compositionEnd);
      document.addEventListener('visibilitychange', this.visibilityChanged);
      window.addEventListener('pagehide', this.pageHidden);
      await this.register();
      // Disk leases make a terminated process recoverable after at most 20 seconds.
      // Native owner heartbeats run outside the webview so hidden windows stay protected.
      scanTimer = setInterval(() => {
        if (!this.registered || this.pending) return;
        void repository?.heartbeat?.(owner).catch(() => this.fail('draftSaveFailed', () => this.capture()));
        void this.refresh(false);
      }, 5_000);
    },
    async register() {
      try {
        await repository!.register(owner);
        this.errorKey = null;
        retryOperation = undefined;
        await this.refresh(true);
        this.registered = true;
        if (!useAppStore().isSave) this.schedule();
      } catch { this.fail('draftLoadFailed', () => this.register()); }
    },
    fail(key: string, retry: () => Promise<unknown>) {
      this.errorKey = key;
      retryOperation = retry;
    },
    async retry() {
      if (this.pending || this.saving || !retryOperation) return;
      await retryOperation();
    },
    async refresh(showError = true) {
      try {
        const listed = await repository!.list();
        const drafts = [...listed, ...[...pendingClaims.values()].filter(claim => !listed.some(draft => draft.id === claim.id))]
          .sort((a, b) => b.updatedAt - a.updatedAt);
        this.recoverable = drafts;
        if (!drafts.some(draft => draft.id === this.selectedId)) this.selectedId = drafts[0]?.id || null;
        if (showError && this.errorKey === 'draftLoadFailed') { this.errorKey = null; retryOperation = undefined; }
        this.offerRecovery();
      } catch {
        if (showError) this.fail('draftLoadFailed', () => this.refresh());
      }
    },
    offerRecovery() {
      const app = useAppStore();
      const editor = useEditorStore();
      if (!autoOpened && this.recoverable.length && !app.loading && app.isSave
        && !app.exporting && editor.editor && !editor.loading && !editor.renderingDocument && !editor.segmentLoading && !editor.sourceComposing) {
        autoOpened = true;
        this.visible = true;
      }
    },
    review() { this.visible = true; this.discardingId = null; },
    defer() { if (!this.pending) { this.visible = false; this.discardingId = null; } },
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; void this.capture(false); }, WRITE_DELAY_MS);
    },
    async capture(force = true): Promise<void> {
      if (timer) clearTimeout(timer);
      timer = undefined;
      const app = useAppStore();
      const editor = useEditorStore();
      if (!this.registered || app.isSave || restoring || composing || editor.sourceComposing || editor.loading || editor.renderingDocument || editor.segmentLoading) return;
      if (!force && clearedDocument?.revision === app.editRevision && clearedDocument.renderVersion === editor.renderVersion) return;
      if (clearing) { this.schedule(); return; }
      const markdown = editor.getMarkdown();
      if (typeof markdown !== 'string') return;
      if (draftByteLength(markdown) > DRAFT_MAX_BYTES) {
        this.fail('draftTooLarge', () => this.capture());
        return;
      }
      if (!currentId) {
        clearedDocument = null;
        currentId = crypto.randomUUID();
        sourcePath = app.filepath || this.resourceSourcePath;
        sourceTitle = app.title || sourceTitle;
      }
      const draft: DraftSnapshot = { schemaVersion: 1, id: currentId, owner,
        sourcePath, title: sourceTitle, markdown, updatedAt: Date.now() };
      const version = generation;
      const write = async () => {
        if (version !== generation) return;
        this.saving = true;
        try {
          await repository!.write(draft);
          if (version === generation) {
            this.savedAt = draft.updatedAt;
            if (this.errorKey === 'draftSaveFailed' || this.errorKey === 'draftTooLarge') {
              this.errorKey = null; retryOperation = undefined;
            }
          }
        } catch { if (version === generation) this.fail('draftSaveFailed', () => this.capture()); }
        finally { this.saving = false; }
      };
      queue = queue.then(write, write);
      await queue;
    },
    async clearCurrent(): Promise<boolean> {
      if (timer) clearTimeout(timer);
      timer = undefined;
      generation += 1;
      clearing = true;
      const revision = useAppStore().editRevision;
      const renderVersion = useEditorStore().renderVersion;
      await queue;
      if (!currentId) { clearedDocument = { revision, renderVersion }; clearing = false; return true; }
      try {
        await repository!.remove(currentId, owner);
        currentId = null;
        clearedDocument = { revision, renderVersion };
        // A cancelled cross-window quit can leave this same document open after
        // choosing Discard. Its source context survives until an actual replacement.
        if (useAppStore().isSave) this.resourceSourcePath = null;
        this.savedAt = null;
        this.recoveredSource = null;
        this.errorKey = null;
        retryOperation = undefined;
        return true;
      } catch {
        this.fail('draftDiscardFailed', async () => {
          const cleared = await this.clearCurrent();
          if (cleared) useAppStore().draftCleanupPending = false;
          return cleared;
        });
        return false;
      } finally {
        clearing = false;
        if (!useAppStore().isSave && useAppStore().editRevision !== revision) this.schedule();
      }
    },
    async restore(candidateId?: string | null): Promise<void> {
      const id = candidateId === undefined ? this.selectedId : candidateId;
      if (!id || this.pending) return;
      const app = useAppStore();
      const editor = useEditorStore();
      if (app.loading || editor.loading || editor.renderingDocument || editor.segmentLoading || editor.sourceComposing || !editor.editor) return;
      this.pending = true;
      this.discardingId = null;
      let ownsResourceTask = false;
      let previous: {
        editorState: typeof editor.$state;
        viewState: typeof editor.editor.state;
        filepath: string | null;
        title: string | null;
        isSave: boolean;
        saveError: string | null;
        fileVersion: typeof app.fileVersion;
        fileCanonicalPath: string | null;
        fileConflict: typeof app.fileConflict;
        resourceSourcePath: string | null;
      } | undefined;
      try {
        if (!await app.guardUnsavedChanges()) return;
        app.resourceTasks += 1;
        ownsResourceTask = true;
        const draft = await repository!.claim(id, owner);
        pendingClaims.set(id, summarizeDraft(draft));
        previous = {
          editorState: { ...editor.$state, segments: [...editor.segments], headings: [...editor.headings],
            segmentHeadings: editor.segmentHeadings.map(headings => [...headings]) },
          viewState: editor.editor.state, filepath: app.filepath, title: app.title,
          isSave: app.isSave, saveError: app.saveError, fileVersion: app.fileVersion,
          fileCanonicalPath: app.fileCanonicalPath, fileConflict: app.fileConflict,
          resourceSourcePath: this.resourceSourcePath,
        };
        restoring = true;
        // Restore as an unnamed copy: the original file may have changed externally.
        // Even an enabled auto-save cannot overwrite it without an explicit Save As.
        this.resourceSourcePath = draft.sourcePath;
        app.cancelScheduledAutoSave();
        app.setFilepath(null);
        await editor.setContent(draft.markdown);
        if (editor.renderingDocument) throw new Error('draft_restore_failed');
        currentId = draft.id;
        sourcePath = draft.sourcePath;
        sourceTitle = draft.title;
        app.markEdited();
        this.recoveredSource = draft.sourcePath || draft.title || '';
        this.savedAt = draft.updatedAt;
        this.errorKey = null;
        retryOperation = undefined;
        this.visible = false;
        pendingClaims.delete(id);
        this.recoverable = this.recoverable.filter(candidate => candidate.id !== id);
        await nextTick();
        editor.focus();
      } catch {
        if (previous) {
          const version = editor.renderVersion + 1;
          editor.$patch({ ...previous.editorState, renderVersion: version });
          const current = editor.editor as unknown as { reactiveState: Ref<typeof previous.viewState> };
          current.reactiveState.value = previous.viewState;
          editor.editor.view.updateState(previous.viewState);
          app.setFilepath(previous.filepath);
          app.title = previous.title;
          app.isSave = previous.isSave;
          app.saveError = previous.saveError;
          app.fileVersion = previous.fileVersion;
          app.fileCanonicalPath = previous.fileCanonicalPath;
          app.fileConflict = previous.fileConflict;
          this.resourceSourcePath = previous.resourceSourcePath;
        }
        this.fail('draftRestoreFailed', () => this.restore(id));
      }
      finally {
        if (ownsResourceTask) app.resourceTasks = Math.max(0, app.resourceTasks - 1);
        restoring = false;
        this.pending = false;
        // Guarding recovery may have explicitly discarded the previous draft.
        // If claim/render then fails, that still-visible dirty document needs a
        // fresh independent snapshot even when the user makes no further edit.
        if (this.errorKey === 'draftRestoreFailed' && !app.isSave) await this.capture();
      }
    },
    async discard(candidateId?: string | null): Promise<void> {
      const id = candidateId === undefined ? this.discardingId : candidateId;
      if (!id || this.pending) return;
      this.pending = true;
      try {
        await repository!.remove(id, owner);
        pendingClaims.delete(id);
        this.discardingId = null;
        this.errorKey = null;
        retryOperation = undefined;
        await this.refresh();
        if (!this.recoverable.length) this.visible = false;
      } catch { this.fail('draftDiscardFailed', () => this.discard(id)); }
      finally { this.pending = false; }
    },
    compositionStart() { composing = true; },
    compositionEnd() { composing = false; this.schedule(); },
    visibilityChanged() {
      if (document.visibilityState === 'hidden') void this.capture(false);
      else if (this.registered) {
        void repository?.heartbeat?.(owner).catch(() => this.fail('draftSaveFailed', () => this.capture()));
        void this.refresh(false);
      }
    },
    pageHidden() { void this.capture(false); },
    dispose() {
      for (const stop of stops) stop();
      stops = [];
      if (timer) clearTimeout(timer);
      if (scanTimer) clearInterval(scanTimer);
      document.removeEventListener('compositionstart', this.compositionStart);
      document.removeEventListener('compositionend', this.compositionEnd);
      document.removeEventListener('visibilitychange', this.visibilityChanged);
      window.removeEventListener('pagehide', this.pageHidden);
      // Unmount must not remove document snapshots. Only explicit save/discard does that.
      try { repository?.release?.(owner); } catch { /* The lease will expire. */ }
    },
  },
});
