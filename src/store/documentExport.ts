import { defineStore } from 'pinia';
import { save, message } from '@tauri-apps/plugin-dialog';
import { sendNotification } from '@tauri-apps/plugin-notification';
import * as appLog from '@tauri-apps/plugin-log';
import { useAppStore } from './app';
import { useEditorStore } from './editor';
import { useDraftsStore } from './drafts';
import { collectWordEquations, exportHTML, exportPDF, exportWord } from '../api/file';
import { renderDocumentHTML } from '../utils/documentExport';
import { renderWordDiagrams } from '../utils/wordDiagrams';
import { renderWordEquations } from '../utils/wordEquations';
import i18n from '../i18n';

export type DocumentExportFormat = 'html' | 'pdf' | 'word';

export const useDocumentExportStore = defineStore('documentExport', {
  state: (): { pending: boolean; error: string | null } => ({ pending: false, error: null }),
  actions: {
    async exportDocument(format: DocumentExportFormat): Promise<boolean> {
      const app = useAppStore();
      const document = useEditorStore();
      const editor = document.editor;
      if (this.pending || app.exporting || app.lifecycleBusy || document.loading || document.renderingDocument || document.segmentLoading || document.sourceComposing || !editor) return false;
      const markdown = document.getMarkdown();
      if (typeof markdown !== 'string') return false;
      const sourcePath = app.filepath || useDraftsStore().resourceSourcePath;
      const title = app.title || 'MarkNote';
      const extension = format === 'word' ? 'docx' : format;
      const label = format === 'pdf' ? 'PDF' : i18n.global.t(format);
      this.pending = true;
      this.error = null;
      app.exporting = true;
      try {
        const path = await save({
          title: `${i18n.global.t('export')} ${label}`,
          defaultPath: sourcePath ? sourcePath.replace(/\.[^./\\]+$/, '') + '.' + extension : 'MarkNote.' + extension,
          filters: [{ name: label, extensions: [extension] }],
        });
        if (!path) return false;
        let response: unknown;
        if (format === 'word') {
          const diagrams = await renderWordDiagrams(markdown);
          const equations = renderWordEquations(await collectWordEquations(markdown));
          response = await exportWord(path, markdown, sourcePath, diagrams, equations);
        } else {
          const html = await renderDocumentHTML(editor, markdown, sourcePath, {
            print: format === 'pdf', title, locale: i18n.global.locale.value,
          });
          response = await (format === 'pdf' ? exportPDF(path, html) : exportHTML(path, html));
        }
        const result = response as { code?: number; info?: string } | null;
        if (!result || result.code !== 0) throw new Error(result?.info || i18n.global.t('exportFailed'));
        try {
          sendNotification({ title: `${i18n.global.t('export')} ${label}`, body: path });
        } catch (error) {
          void appLog.warn('Export notification failed: ' + String(error));
        }
        return true;
      } catch (error) {
        this.error = String(error || i18n.global.t('exportFailed'));
        void appLog.error(`${format} export failed: ${this.error}`);
        try { await message(this.error, i18n.global.t('exportFailed')); }
        catch (dialogError) { void appLog.error('Export error dialog failed: ' + String(dialogError)); }
        return false;
      } finally {
        this.pending = false;
        app.exporting = false;
      }
    },
  },
});
