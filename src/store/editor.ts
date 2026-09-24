import { Editor } from '@tiptap/vue-3';
import { EditorState } from '@tiptap/pm/state';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { defineStore } from 'pinia';
import { shallowRef, type Ref } from 'vue';
import * as appLog from '@tauri-apps/plugin-log';
import { isTauri } from '@tauri-apps/api/core';
import { renderMarkdown } from '../api/utils';
import {
  LARGE_FILE_THRESHOLD,
  preserveBoundaryNewlines,
  splitMarkdownIntoSegments,
  utf8ByteLength,
} from '../utils/largeFile';

export { LARGE_FILE_THRESHOLD } from '../utils/largeFile';

const editorRef = shallowRef<Editor>();

export interface Heading {
  level: number,
  text: string,
  id: string,
  status: 'open' | 'close',
  show: boolean,
}

export const useEditorStore = defineStore('editor', {
  state(): {
    codeTheme: string,
    loading: boolean,
    headings: Heading[],
    findVisbile: boolean,
    segmented: boolean,
    segments: string[],
    segmentIndex: number,
    segmentDirty: boolean,
    pendingContent: string | null,
    renderVersion: number,
    renderingDocument: boolean,
  } {
    return {
      codeTheme: localStorage.getItem('codeTheme') || 'nnfx-light',
      loading: false,
      headings: [],
      findVisbile: false,
      segmented: false,
      segments: [],
      segmentIndex: 0,
      segmentDirty: false,
      pendingContent: null,
      renderVersion: 0,
      renderingDocument: false,
    }
  },

  getters: {
    editor(): Editor {
      return editorRef.value as Editor;
    },
    segmentCount(): number {
      return this.segmented ? this.segments.length : 1;
    },
  },

  actions: {
    setEditor(editor: Editor | undefined) {
      editorRef.value = editor;
    },
    replaceEditorDocument(body: HTMLElement) {
      const editor = this.editor;
      if (!editor) {
        appLog.error(`editor unavailable while loading ${body.textContent?.length || 0} characters`);
        return;
      }
      const doc = ProseMirrorDOMParser.fromSchema(editor.schema).parse(body);
      doc.check();
      // A newly opened file or segment needs fresh plugin history.
      const current = editor.view.state;
      const state = EditorState.create({
        schema: current.schema,
        doc,
        plugins: current.plugins,
      });
      // Tiptap's Vue editor reads from reactiveState in dispatchTransaction.
      // Keep it in sync before node views can dispatch while updateState runs.
      (editor as unknown as { reactiveState: Ref<EditorState> }).reactiveState.value = state;
      editor.view.updateState(state);
    },

    async renderEditorBody(content: string): Promise<HTMLElement> {
      const parser = this.editor.storage.markdown.parser;
      if (!content) return new window.DOMParser().parseFromString('<body></body>', 'text/html').body;
      if (isTauri()) {
        try {
          const html = await renderMarkdown(content);
          return parser.parseRenderedDom(html, { content });
        } catch (error) {
          appLog.error(`Rust Markdown rendering failed: ${String(error)}`);
        }
      }
      const html = parser.parse(content);
      return new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
    },

    async flushPendingContent() {
      if (this.pendingContent === null || !this.editor) return;
      const content = this.pendingContent;
      const version = ++this.renderVersion;
      try {
        const body = await this.renderEditorBody(content);
        if (version !== this.renderVersion || !this.editor) return;
        this.replaceEditorDocument(body);
        this.pendingContent = null;
        this.renderingDocument = false;
        this.updateHeadings();
      } catch (error) {
        if (version === this.renderVersion) {
          appLog.error(`editor document rendering failed: ${String(error)}`);
        }
        throw error;
      }
    },

    async setContent(content: string) {
      ++this.renderVersion;
      this.renderingDocument = true;
      this.segmented = utf8ByteLength(content) >= LARGE_FILE_THRESHOLD;
      this.segments = this.segmented ? splitMarkdownIntoSegments(content) : [];
      this.segmentIndex = 0;
      this.segmentDirty = false;
      this.findVisbile = false;
      this.pendingContent = this.segmented ? this.segments[0] : content;
      await this.flushPendingContent();
    },

    markCurrentSegmentEdited() {
      if (this.segmented) this.segmentDirty = true;
    },

    commitCurrentSegment() {
      if (!this.segmented || !this.segmentDirty || !this.editor) return;
      const markdown = this.editor.storage.markdown.getMarkdown();
      this.segments[this.segmentIndex] = preserveBoundaryNewlines(
        markdown,
        this.segments[this.segmentIndex],
      );
      this.segmentDirty = false;
    },

    async showSegment(index: number, focusPosition: 'start' | 'end' = 'start'): Promise<boolean> {
      if (!this.segmented || index < 0 || index >= this.segments.length || index === this.segmentIndex) return false;
      const version = ++this.renderVersion;
      let body: HTMLElement;
      try {
        body = await this.renderEditorBody(this.segments[index]);
      } catch (error) {
        if (version === this.renderVersion) {
          appLog.error(`segment rendering failed: ${String(error)}`);
        }
        return false;
      }
      if (version !== this.renderVersion || !this.editor || !this.segmented) return false;
      this.commitCurrentSegment();
      this.segmentIndex = index;
      this.segmentDirty = false;
      this.replaceEditorDocument(body);
      this.updateHeadings();
      this.editor?.commands.focus(focusPosition);
      return true;
    },

    getMarkdown(): string | undefined {
      if (!this.editor || this.renderingDocument) return undefined;
      if (!this.segmented) return this.editor.storage.markdown.getMarkdown();
      this.commitCurrentSegment();
      return this.segments.join('');
    },

    focus() {
      this.editor?.commands.focus();
    },

    updateHeadings() {
      if (!this.editor) return;
      const items: Heading[] = [];
      const transaction = this.editor.state.tr;

      this.editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const id = `heading-${items.length + 1}`;
          if (node.attrs.id !== id) {
            transaction.setNodeMarkup(pos, undefined, { ...node.attrs, id });
          }
          items.push({
            level: node.attrs.level,
            text: node.textContent,
            id,
            status: 'open',
            show: true,
          });
        }
      });

      transaction.setMeta('addToHistory', false);
      transaction.setMeta('preventUpdate', true);
      this.editor.view.dispatch(transaction);
      this.headings = items;
    },
  },
});
