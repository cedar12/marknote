import { defineStore } from 'pinia';
import { useAppStore } from './app';
import { useEditorStore } from './editor';
import { useFileComparisonStore } from './fileComparison';
import { scanDocument, SEARCH_QUERY_LIMIT, SEARCH_REPLACE_LIMIT, type SourceSearchMatch } from '../utils/documentSearch';
import { startWorkspaceSearch, nextWorkspaceSearch, cancelWorkspaceSearch, type WorkspaceSearchMatch, type WorkspaceSearchPage } from '../api/workspaceSearch';
import { fileIdentity, sameFileContents } from '../utils/fileVersion';
import { sourceReplacementLimit } from '../utils/sourceDocument';

let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0, activeSearchId: string | null = null;
export type DocumentSearchResult = SourceSearchMatch | WorkspaceSearchMatch;
export interface ReplacementPreview { original: string; ranges: { from: number; to: number; replacement: string }[]; generation: number }

export const useDocumentSearchStore = defineStore('documentSearch', {
  state: () => ({
    scope: 'document' as 'document' | 'workspace', query: '', matchCase: false, composing: false,
    results: [] as DocumentSearchResult[], selected: -1, searching: false, locating: false, previewing: false,
    sourceSnapshot: '', searchedPath: null as string | null, searchedRoot: null as string | null,
    stale: false, cancelled: false, truncated: false, completed: false, progress: 0,
    workspaceProgress: null as WorkspaceSearchPage | null, errorKey: null as string | null,
    replacement: '', replacementPreview: null as ReplacementPreview | null, replaceError: null as string | null,
    focusRequest: 0,
  }),
  getters: {
    documentBusy: () => {
      const app = useAppStore(), editor = useEditorStore();
      return app.loading || app.lifecycleBusy || app.exporting || app.saving || app.resourceTasks > 0 || editor.loading || editor.renderingDocument || editor.segmentLoading || editor.sourceComposing || editor.navigatingToHeading
        || useFileComparisonStore().visible || (editor.sourceMode === 'wysiwyg' ? editor.editor?.isEditable === false : !editor.sourceEditable);
    },
    busy(): boolean { return this.searching || this.locating || this.previewing; },
  },
  actions: {
    open(scope: 'document' | 'workspace') {
      const app = useAppStore();
      this.scope = scope; app.sidebar.visible = true; app.sidebar.active = 'search';
      this.focusRequest++;
      if (this.query) this.schedule();
    },
    cancel(markCancelled = true) {
      generation++;
      if (timer) clearTimeout(timer);
      timer = undefined;
      const id = activeSearchId; activeSearchId = null;
      if (id) void cancelWorkspaceSearch(id).catch(() => {});
      this.searching = false; this.previewing = false;
      this.cancelled = markCancelled;
      this.replacementPreview = null;
    },
    clear() { this.cancel(false); this.query = ''; this.results = []; this.selected = -1; this.stale = false; this.completed = false; this.errorKey = null; this.replaceError = null; this.progress = 0; this.workspaceProgress = null; this.truncated = false; this.sourceSnapshot = ''; this.searchedPath = null; this.searchedRoot = null; },
    schedule() {
      this.cancel(false); this.errorKey = null; this.completed = false; this.results = []; this.selected = -1; this.stale = false; this.replaceError = null;
      this.progress = 0; this.workspaceProgress = null; this.truncated = false;
      if (!this.query || this.composing) return;
      if (this.query.length > SEARCH_QUERY_LIMIT) { this.errorKey = 'searchQueryTooLong'; return; }
      timer = setTimeout(() => { timer = undefined; void this.search(); }, 300);
    },
    invalidate() {
      if (!this.query) return;
      this.cancel(false);
      this.stale = true;
      this.replacementPreview = null;
    },
    async search() {
      this.cancel(false);
      if (!this.query || this.composing) return;
      if (this.query.length > SEARCH_QUERY_LIMIT) { this.errorKey = 'searchQueryTooLong'; return; }
      const request = generation, query = this.query, matchCase = this.matchCase, scope = this.scope;
      this.searching = true; this.results = []; this.selected = -1; this.stale = false; this.errorKey = null;
      this.completed = false; this.truncated = false; this.progress = 0; this.workspaceProgress = null;
      try {
        const app = useAppStore(), editor = useEditorStore();
        if (scope === 'document') {
          if (this.documentBusy) throw new Error('searchDocumentBusy');
          const snapshot = editor.getMarkdown();
          if (typeof snapshot !== 'string') throw new Error('searchDocumentBusy');
          const revision = app.editRevision, documentGeneration = editor.documentGeneration;
          this.sourceSnapshot = snapshot; this.searchedPath = app.filepath;
          const scan = await scanDocument(snapshot, query, matchCase, {
            cancelled: () => request !== generation || app.editRevision !== revision || editor.documentGeneration !== documentGeneration,
            progress: offset => { if (request === generation) this.progress = snapshot.length ? offset / snapshot.length : 1; },
          });
          if (request !== generation) return;
          if (scan.cancelled) { this.stale = true; return; }
          this.results = scan.results; this.truncated = scan.truncated;
        } else {
          const root = app.folder;
          if (!root) throw new Error('searchNoWorkspace');
          this.searchedRoot = root;
          const id = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; activeSearchId = id;
          let page = await startWorkspaceSearch(id, root, query, matchCase);
          while (request === generation && app.folder === root) {
            if (page.searchId !== id || !Array.isArray(page.results)) throw new Error('searchWorkspaceFailed');
            this.workspaceProgress = page;
            this.results.push(...page.results);
            this.truncated = page.truncated;
            if (page.done || page.cancelled) break;
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            if (request !== generation) break;
            page = await nextWorkspaceSearch(id);
          }
          if (request !== generation || app.folder !== root) return;
          this.cancelled = page.cancelled;
        }
        this.completed = true;
      } catch (error) {
        if (request === generation) {
          const key = error instanceof Error ? error.message : '';
          this.errorKey = ['searchDocumentBusy', 'searchNoWorkspace', 'searchQueryTooLong', 'searchWorkspaceNativeOnly'].includes(key) ? key : 'searchWorkspaceFailed';
        }
      } finally {
        if (request === generation) { this.searching = false; const id = activeSearchId; activeSearchId = null; if (id) void cancelWorkspaceSearch(id).catch(() => {}); }
      }
    },
    async locate(index: number) {
      if (this.searching || this.locating || this.composing || this.documentBusy || this.stale) return false;
      const result = this.results[index]; if (!result) return false;
      const request = generation, app = useAppStore(), editor = useEditorStore();
      this.locating = true; this.errorKey = null;
      try {
        let expected = this.sourceSnapshot;
        if ('path' in result) {
          const opened = await app.openMarkdownDocument(result.path);
          if (opened === 'cancelled') return false;
          if (opened !== 'opened') throw new Error('searchOpenFailed');
          if (!sameFileContents(app.fileVersion, result.version) || !app.fileCanonicalPath
            || fileIdentity(app.fileCanonicalPath, app.platform === 'windows') !== fileIdentity(result.path, app.platform === 'windows')) { this.stale = true; return false; }
          expected = editor.getMarkdown() || '';
        }
        if (request !== generation || editor.getMarkdown() !== expected || !expected.slice(result.from, result.to).match(literalFullQuery(this.query, this.matchCase))) { this.stale = true; return false; }
        const located = await editor.openSourceRange(result.from, result.to, expected);
        if (!located) { this.stale = true; return false; }
        this.selected = index;
        return true;
      } catch { this.errorKey = 'searchOpenFailed'; return false; }
      finally { this.locating = false; }
    },
    async previewReplacement(all: boolean) {
      if (this.scope !== 'document' || this.busy || this.documentBusy || this.stale || this.composing) return false;
      const editor = useEditorStore(), snapshot = editor.getMarkdown();
      if (snapshot !== this.sourceSnapshot) { this.stale = true; return false; }
      const request = generation;
      this.previewing = true; this.replaceError = null;
      try {
        const scan = all ? await scanDocument(snapshot, this.query, this.matchCase, { limit: SEARCH_REPLACE_LIMIT, cancelled: () => request !== generation })
          : { results: [this.results[this.selected >= 0 ? this.selected : 0]].filter(Boolean), truncated: false, cancelled: false };
        if (request !== generation || scan.cancelled) return false;
        if (scan.truncated) { this.replaceError = 'searchReplaceLimit'; return false; }
        if (!scan.results.length) return false;
        const ranges = scan.results.map(({ from, to }) => ({ from, to, replacement: this.replacement })).filter(range => snapshot.slice(range.from, range.to) !== range.replacement);
        if (!ranges.length) { this.replaceError = 'searchNoChanges'; return false; }
        const limit = sourceReplacementLimit(snapshot, ranges, editor.sourceDocument.historyByteLimit);
        if (limit) { this.replaceError = limit === 'history' ? 'sourceChangeTooLarge' : limit === 'document' ? 'searchReplaceTooLarge' : 'searchReplaceFailed'; return false; }
        this.replacementPreview = { original: snapshot, ranges, generation: request };
        return true;
      } finally { if (request === generation) this.previewing = false; }
    },
    async confirmReplacement() {
      const preview = this.replacementPreview;
      if (!preview || this.documentBusy || this.locating || this.composing) return false;
      const editor = useEditorStore();
      if (preview.generation !== generation || editor.getMarkdown() !== preview.original) { this.stale = true; this.replacementPreview = null; return false; }
      this.locating = true;
      try {
        const success = await editor.replaceSourceRanges(preview.ranges, preview.original);
        this.replacementPreview = null;
        if (!success) { this.stale = true; return false; }
        this.schedule(); return true;
      } catch { this.replaceError = 'searchReplaceFailed'; return false; }
      finally { this.locating = false; }
    },
  },
});
function literalFullQuery(query: string, matchCase: boolean) { return new RegExp(`^(?:${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, matchCase ? 'u' : 'iu'); }
