import { defineStore } from 'pinia';
import { save } from '@tauri-apps/plugin-dialog';
import { sendNotification } from '@tauri-apps/plugin-notification';
import * as appLog from '@tauri-apps/plugin-log';
import { useAppStore } from './app';
import { useEditorStore } from './editor';
import { exportImage as writeImage } from '../api/file';
import i18n from '../i18n';
import { ImageExportError, renderDocumentImage } from '../utils/imageExport';
import {
  normalizeImageExportOptions,
  readImageExportOptions,
  saveImageExportOptions,
  type ImageExportOptions,
} from '../utils/imageExportOptions';

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Image encoding returned no data'));
    reader.onerror = () => reject(reader.error || new Error('Image encoding failed'));
    reader.readAsDataURL(blob);
  });
}

export const useImageExportStore = defineStore('imageExport', {
  state: (): {
    visible: boolean;
    pending: boolean;
    stage: 'idle' | 'rendering' | 'saving';
    error: string | null;
    options: ImageExportOptions;
  } => ({
    visible: false,
    pending: false,
    stage: 'idle',
    error: null,
    options: readImageExportOptions(),
  }),
  actions: {
    open() {
      if (this.pending || this.visible) return;
      this.options = readImageExportOptions();
      this.error = null;
      this.stage = 'idle';
      this.visible = true;
    },
    close() {
      if (!this.pending) this.visible = false;
    },
    async exportImage() {
      if (this.pending) return;
      const app = useAppStore();
      const editorStore = useEditorStore();
      const editor = editorStore.editor;
      if (!editor || app.exporting || editorStore.loading || editorStore.renderingDocument || editorStore.navigatingToHeading) {
        this.error = 'imageExportUnavailable';
        return;
      }

      const markdown = editorStore.getMarkdown();
      if (typeof markdown !== 'string') {
        this.error = 'imageExportUnavailable';
        return;
      }
      const sourcePath = app.filepath;
      const options = normalizeImageExportOptions(this.options);
      this.options = options;
      this.pending = true;
      this.error = null;
      let phase: 'picker' | 'render' | 'write' = 'picker';
      let capturing = false;
      try {
        const extension = options.format === 'jpeg' ? 'jpg' : 'png';
        const defaultPath = sourcePath
          ? sourcePath.replace(/\.[^./\\]+$/, '') + '.' + extension
          : 'MarkNote.' + extension;
        const path = await save({
          title: i18n.global.t('imageExportTitle'),
          defaultPath,
          filters: [{
            name: options.format === 'jpeg' ? 'JPEG' : 'PNG',
            extensions: options.format === 'jpeg' ? ['jpg', 'jpeg'] : ['png'],
          }],
        });
        if (!path) return;
        const validExtension = options.format === 'jpeg' ? /\.(jpe?g)$/i : /\.png$/i;
        if (!validExtension.test(path)) {
          this.error = 'imageExportPathMismatch';
          return;
        }

        phase = 'render';
        this.stage = 'rendering';
        app.exporting = true;
        capturing = true;
        const blob = await renderDocumentImage(editor, markdown, options, sourcePath);
        this.stage = 'saving';
        const dataUrl = await blobDataUrl(blob);
        phase = 'write';
        const response = await writeImage(path, dataUrl) as { code?: number; info?: string } | null;
        if (!response || response.code !== 0) {
          throw new Error(response?.info || 'Image write failed');
        }

        saveImageExportOptions(options);
        this.visible = false;
        try {
          sendNotification({ title: i18n.global.t('imageExportSucceeded'), body: path });
        } catch (notificationError) {
          void appLog.warn('Image export notification failed: ' + String(notificationError));
        }
      } catch (error) {
        const key = error instanceof ImageExportError
          ? error.code
          : phase === 'picker' ? 'imageExportPickerFailed'
          : phase === 'write' ? 'imageExportWriteFailed'
          : 'imageExportRenderFailed';
        this.error = key;
        void appLog.error('Image export ' + phase + ' failed: ' + String(error));
      } finally {
        if (capturing) app.exporting = false;
        this.pending = false;
        this.stage = 'idle';
      }
    },
  },
});
