import { Editor } from '@tiptap/vue-3';
import { EditorState } from '@tiptap/pm/state';
import { defineStore } from 'pinia';
import {
  LARGE_FILE_THRESHOLD,
  preserveBoundaryNewlines,
  splitMarkdownIntoSegments,
  utf8ByteLength,
} from '../utils/largeFile';

export { LARGE_FILE_THRESHOLD } from '../utils/largeFile';

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
    }
  },

  getters: {
    editor(): Editor {
      // @ts-ignore
      return window.editor?.value;
    },
    segmentCount(): number {
      return this.segmented ? this.segments.length : 1;
    },
  },

  actions: {
    replaceEditorDocument(content: string) {
      if (!this.editor) return;
      this.editor.commands.setContent(content, false);

      // Segment changes are document changes, not user edits. Recreate plugin
      // state so Undo cannot pull content from a previously visible segment.
      const state = EditorState.create({
        schema: this.editor.state.schema,
        doc: this.editor.state.doc,
        plugins: this.editor.state.plugins,
      });
      this.editor.view.updateState(state);
    },

    setContent(content: string) {
      this.segmented = utf8ByteLength(content) >= LARGE_FILE_THRESHOLD;
      this.segments = this.segmented ? splitMarkdownIntoSegments(content) : [];
      this.segmentIndex = 0;
      this.segmentDirty = false;
      this.findVisbile = false;
      this.replaceEditorDocument(this.segmented ? this.segments[0] : content);
      this.updateHeadings();
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

    showSegment(index: number, focusPosition: 'start' | 'end' = 'start') {
      if (!this.segmented || index < 0 || index >= this.segments.length || index === this.segmentIndex) return;
      this.commitCurrentSegment();
      this.segmentIndex = index;
      this.segmentDirty = false;
      this.replaceEditorDocument(this.segments[index]);
      this.updateHeadings();
      this.editor?.commands.focus(focusPosition);
    },

    getMarkdown(): string | undefined {
      if (!this.editor) return undefined;
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
