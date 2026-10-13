import { defineStore } from 'pinia';
import { markRaw, watch, type WatchStopHandle } from 'vue';
import { read } from '../api/file';
import { useAppStore } from './app';
import { useEditorStore } from './editor';
import { fileIdentity, normalizeFileVersion, sameFileContents, type FileVersion } from '../utils/fileVersion';
import { compareText, type TextDiffResult } from '../utils/textDiff';

interface ComparisonSnapshot {
  revision: number;
  renderVersion: number;
  filepath: string | null;
  canonical: string | null;
  baseline: string;
  conflict: string;
  target: string;
  targetCanonical: string;
  // Identity only; storing Editor's private fields through Pinia's deep unwrap
  // would make the snapshot type incompatible with the original instance.
  editor: object | undefined;
}

let sequence = 0;
let stopWatching: WatchStopHandle | undefined;
function versionKey(version: FileVersion | null | undefined): string {
  return version ? `${version.exists}:${version.size}:${version.hash}:${version.mtimeNs}` : '';
}
function conflictKey(): string {
  const conflict = useAppStore().fileConflict;
  return conflict ? `${conflict.path}:${conflict.canonicalPath}:${versionKey(conflict.version)}` : '';
}

export const useFileComparisonStore = defineStore('fileComparison', {
  state: () => ({
    visible: false,
    pending: false,
    stale: false,
    errorKey: null as string | null,
    path: '',
    result: null as TextDiffResult | null,
    diskVersion: null as FileVersion | null,
    snapshot: null as ComparisonSnapshot | null,
  }),
  actions: {
    busy(): boolean {
      const app = useAppStore(), editor = useEditorStore();
      return app.loading || app.lifecycleBusy || app.saving || app.exporting || app.resourceTasks > 0
        || editor.loading || editor.renderingDocument || editor.segmentLoading || editor.navigatingToHeading
        || editor.sourceComposing || !editor.editor;
    },
    unchanged(snapshot: ComparisonSnapshot, includeConflict = true): boolean {
      const app = useAppStore(), editor = useEditorStore();
      return !this.busy() && snapshot.revision === app.editRevision && snapshot.renderVersion === editor.renderVersion
        && snapshot.filepath === app.filepath && snapshot.canonical === app.fileCanonicalPath
        && snapshot.baseline === versionKey(app.fileVersion) && snapshot.editor === editor.editor
        && (!includeConflict || snapshot.conflict === conflictKey());
    },
    observe() {
      stopWatching?.();
      const app = useAppStore(), editor = useEditorStore();
      stopWatching = watch(() => [app.editRevision, app.filepath, app.fileCanonicalPath, versionKey(app.fileVersion),
        conflictKey(), editor.renderVersion, editor.editor, editor.sourceComposing, editor.loading,
        editor.renderingDocument, editor.segmentLoading, editor.navigatingToHeading, app.loading,
        app.saving, app.exporting, app.resourceTasks, app.lifecycleBusy], () => this.checkStale(), { flush: 'sync' });
    },
    checkStale() {
      if (!this.visible || !this.snapshot) return;
      const app = useAppStore();
      const diskChanged = this.snapshot.conflict !== conflictKey()
        && (!app.fileConflict || !sameFileContents(app.fileConflict.version, this.diskVersion));
      if (!this.unchanged(this.snapshot, false) || diskChanged) {
        this.stale = true;
        if (this.pending) {
          sequence++;
          this.pending = false;
          this.errorKey = 'fileComparisonChanged';
        }
      }
    },
    async open(): Promise<boolean> {
      sequence++;
      this.visible = true;
      this.pending = false;
      this.result = null;
      this.diskVersion = null;
      this.snapshot = null;
      this.stale = false;
      this.observe();
      return this.refresh();
    },
    close() {
      sequence++;
      this.visible = false;
      this.pending = false;
      this.result = null;
      this.snapshot = null;
      this.diskVersion = null;
      this.errorKey = null;
      this.stale = false;
      stopWatching?.();
      stopWatching = undefined;
    },
    async refresh(): Promise<boolean> {
      if (!this.visible || this.pending) return false;
      const app = useAppStore(), editor = useEditorStore();
      if (this.busy()) { this.errorKey = 'fileComparisonBusy'; return false; }
      const path = app.fileConflict?.path || app.filepath;
      if (!path) { this.errorKey = 'fileComparisonFailed'; return false; }
      const request = ++sequence;
      const snapshot: ComparisonSnapshot = { revision: app.editRevision, renderVersion: editor.renderVersion,
        filepath: app.filepath, canonical: app.fileCanonicalPath, baseline: versionKey(app.fileVersion), conflict: conflictKey(),
        target: path, targetCanonical: app.fileConflict?.canonicalPath || app.fileCanonicalPath || path, editor: editor.editor };
      this.snapshot = markRaw(snapshot);
      this.path = path;
      this.pending = true;
      this.errorKey = null;
      try {
        // getMarkdown owns source mode, attachment aliases and all large-file segments.
        const local = editor.getMarkdown();
        if (typeof local !== 'string') throw new Error('document_unavailable');
        const response = await read(path);
        if (request !== sequence || !this.visible) return false;
        if (!this.unchanged(snapshot)) {
          this.stale = true;
          this.errorKey = 'fileComparisonChanged';
          return false;
        }
        const version = normalizeFileVersion(response?.version);
        if (response?.code !== 0 || typeof response.data !== 'string' || !version || !response.canonicalPath) {
          throw new Error('comparison_read_failed');
        }
        if (fileIdentity(response.canonicalPath, app.platform === 'windows')
          !== fileIdentity(snapshot.targetCanonical, app.platform === 'windows')) {
          this.stale = true;
          this.errorKey = 'fileComparisonChanged';
          return false;
        }
        // Allow the busy state to paint before the bounded comparison work.
        await new Promise(resolve => setTimeout(resolve, 0));
        if (request !== sequence || !this.visible || !this.unchanged(snapshot)) return false;
        const result = compareText(local, response.data);
        if (request !== sequence || !this.visible || !this.unchanged(snapshot)) return false;
        this.result = markRaw(result);
        this.diskVersion = version;
        this.stale = false;
        return true;
      } catch {
        if (request === sequence && this.visible) this.errorKey = 'fileComparisonFailed';
        return false;
      } finally {
        if (request === sequence) this.pending = false;
      }
    },
  },
});
