import { defineStore } from 'pinia'
import { isTauri } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { getConfig, saveMarkdownPreferences as persistMarkdownPreferences } from '../api/preferences';
import { useEditorStore } from './editor';
import { DEFAULT_MARKDOWN_PREFERENCES, MARKDOWN_PREFERENCES_KEY, normalizeMarkdownPreferences, applyMarkdownPreferencesToEditor, type MarkdownPreferences } from '../utils/markdownPreferences';

import { EDITOR_FONT_PREFERENCES_KEY, MIN_EDITOR_FONT_SIZE, MAX_EDITOR_FONT_SIZE, applyEditorFontToDocument, isValidEditorFontFamily, normalizeEditorFont, readEditorFont, type EditorFontPreferences } from '../utils/editorFont';

export type { MarkdownPreferences, BulletListMarker } from '../utils/markdownPreferences';
export { DEFAULT_MARKDOWN_PREFERENCES } from '../utils/markdownPreferences';

export type { EditorFontPreferences } from '../utils/editorFont';

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
    editorFont: EditorFontPreferences,
    savingEditorFont: boolean,
    editorFontSaveError: string | null,
    editorFontSyncError: string | null,
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
      editorFont: readEditorFont(),
      savingEditorFont: false,
      editorFontSaveError: null,
      editorFontSyncError: null,
      markdown: { ...DEFAULT_MARKDOWN_PREFERENCES },
      loadingMarkdown: false,
      savingMarkdown: false,
      markdownLoaded: false,
      markdownLoadError: null,
      markdownSyncError: null,
    }
  },

  actions: {
    applyEditorFont(value: unknown) {
      this.editorFont = normalizeEditorFont(value);
      applyEditorFontToDocument(this.editorFont);
    },
    async saveEditorFont(patch: Partial<EditorFontPreferences>) {
      if (this.savingEditorFont) return;
      this.editorFontSaveError = null;
      this.editorFontSyncError = null;
      const candidate = { ...this.editorFont, ...patch };
      if (!isValidEditorFontFamily(candidate.fontFamily) || !Number.isInteger(candidate.fontSize)
        || candidate.fontSize < MIN_EDITOR_FONT_SIZE || candidate.fontSize > MAX_EDITOR_FONT_SIZE) {
        this.editorFontSaveError = 'invalid';
        throw new Error('Invalid editor font');
      }
      const next = normalizeEditorFont(candidate);
      this.savingEditorFont = true;
      try {
        // Keep the current font when persistence fails; never report an unsaved choice as applied.
        localStorage.setItem(EDITOR_FONT_PREFERENCES_KEY, JSON.stringify(next));
        this.applyEditorFont(next);
      } catch (error) {
        this.editorFontSaveError = String(error);
        this.savingEditorFont = false;
        throw error;
      }
      try {
        if (isTauri()) await emit('editorFontPreferences', next);
      } catch (error) {
        this.editorFontSyncError = String(error);
      } finally {
        this.savingEditorFont = false;
      }
    },
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
