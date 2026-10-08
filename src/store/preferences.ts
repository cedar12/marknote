import { defineStore } from 'pinia'
import { isTauri } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { getConfig, saveMarkdownPreferences as persistMarkdownPreferences } from '../api/preferences';
import { useEditorStore } from './editor';
import { DEFAULT_MARKDOWN_PREFERENCES, MARKDOWN_PREFERENCES_KEY, normalizeMarkdownPreferences, applyMarkdownPreferencesToEditor, type MarkdownPreferences } from '../utils/markdownPreferences';

export type { MarkdownPreferences, BulletListMarker } from '../utils/markdownPreferences';
export { DEFAULT_MARKDOWN_PREFERENCES } from '../utils/markdownPreferences';

export type SegmentNavigationMode = 'buttons' | 'scroll';

const SEGMENT_NAVIGATION_MODE_KEY = 'segmentNavigationMode';
let markdownLoadTask: Promise<void> | null = null;
let markdownRevision = 0;

function savedSegmentNavigationMode(): SegmentNavigationMode {
  return localStorage.getItem(SEGMENT_NAVIGATION_MODE_KEY) === 'scroll' ? 'scroll' : 'buttons';
}

export const usePreferencesStore = defineStore('preferences', {
  state():{
    editor:{
      tabSize:number,
      segmentNavigationMode:SegmentNavigationMode,
    }
    markdown: MarkdownPreferences,
    loadingMarkdown: boolean,
    savingMarkdown: boolean,
    markdownLoaded: boolean,
    markdownLoadError: string | null,
    markdownSyncError: string | null,
  }{
    return {
      editor:{
        tabSize: 4,
        segmentNavigationMode: savedSegmentNavigationMode(),
      },
      markdown: { ...DEFAULT_MARKDOWN_PREFERENCES },
      loadingMarkdown: false,
      savingMarkdown: false,
      markdownLoaded: false,
      markdownLoadError: null,
      markdownSyncError: null,
    }
  },

  actions: {
    applyMarkdownPreferences(value: unknown) {
      markdownRevision += 1;
      const next = normalizeMarkdownPreferences(value);
      const parsingChanged = (['html', 'breaks', 'linkify', 'typographer'] as const)
        .some(key => this.markdown[key] !== next[key]);
      this.markdown = next;
      const editorStore = useEditorStore();
      applyMarkdownPreferencesToEditor(editorStore.editor, this.markdown);
      if (parsingChanged) editorStore.reindexOtherSegments();
    },
    loadMarkdownPreferences(): Promise<void> {
      if (this.markdownLoaded) return Promise.resolve();
      if (markdownLoadTask) return markdownLoadTask;
      this.loadingMarkdown = true;
      this.markdownLoadError = null;
      const revision = markdownRevision;
      markdownLoadTask = (async () => {
        try {
          if (isTauri()) {
            const response = await getConfig() as { code: number; data?: Record<string, string>; info?: string };
            if (response.code !== 0) throw new Error(response.info || 'Could not load Markdown preferences');
            const stored = response.data?.[MARKDOWN_PREFERENCES_KEY];
            if (revision === markdownRevision) {
              this.applyMarkdownPreferences(stored ? JSON.parse(stored) : DEFAULT_MARKDOWN_PREFERENCES);
            }
          }
          this.markdownLoaded = true;
        } catch (error) {
          this.markdownLoadError = String(error);
          throw error;
        } finally {
          this.loadingMarkdown = false;
        }
      })().finally(() => { markdownLoadTask = null; });
      return markdownLoadTask;
    },
    async saveMarkdownPreferences(patch: Partial<MarkdownPreferences>) {
      if (this.savingMarkdown) throw new Error('Markdown preferences are being saved');
      // A failed read must be retried before writing, so existing saved options are not lost.
      if (!this.markdownLoaded) await this.loadMarkdownPreferences();
      if (!this.markdownLoaded) throw new Error('Markdown preferences have not loaded');
      if (this.savingMarkdown) throw new Error('Markdown preferences are being saved');
      const next = normalizeMarkdownPreferences({ ...this.markdown, ...patch });
      this.savingMarkdown = true;
      this.markdownSyncError = null;
      try {
        if (isTauri()) {
          const response = await persistMarkdownPreferences(next);
          if (response.code !== 0) throw new Error(response.info || 'Could not save Markdown preferences');
        }
        this.applyMarkdownPreferences(next);
        if (isTauri()) {
          try {
            await emit('markdownPreferences', next);
          } catch (error) {
            // The database and this window are already updated; only synchronization failed.
            this.markdownSyncError = String(error);
          }
        }
      } finally {
        this.savingMarkdown = false;
      }
    },
    setSegmentNavigationMode(mode: SegmentNavigationMode) {
      if (mode !== 'buttons' && mode !== 'scroll') return;
      this.editor.segmentNavigationMode = mode;
      localStorage.setItem(SEGMENT_NAVIGATION_MODE_KEY, mode);
    },
  },
});
