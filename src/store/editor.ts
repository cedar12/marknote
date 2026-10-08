import { Editor } from '@tiptap/vue-3';
import { EditorState } from '@tiptap/pm/state';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { defineStore } from 'pinia';
import { nextTick, shallowRef, type Ref } from 'vue';
import * as appLog from '@tauri-apps/plugin-log';
import { isTauri } from '@tauri-apps/api/core';
import { renderMarkdown } from '../api/utils';
import { usePreferencesStore } from './preferences';
import { applyMarkdownPreferencesToEditor } from '../utils/markdownPreferences';
import {
  LARGE_FILE_THRESHOLD,
  preserveBoundaryNewlines,
  splitMarkdownIntoSegments,
  utf8ByteLength,
} from '../utils/largeFile';
import { collectMarkdownHeadings, headingId, mergeOutlineHeadings, type Heading, type OutlineHeading } from '../utils/outline';

export { LARGE_FILE_THRESHOLD } from '../utils/largeFile';
export type { Heading } from '../utils/outline';

const editorRef = shallowRef<Editor>();

export const useEditorStore = defineStore('editor', {
  state(): {
    codeTheme: string,
    loading: boolean,
    headings: Heading[],
    segmentHeadings: OutlineHeading[][],
    navigatingToHeading: boolean,
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
      segmentHeadings: [],
      navigatingToHeading: false,
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
      if (editor) applyMarkdownPreferencesToEditor(editor, usePreferencesStore().markdown);
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
          const preferences = usePreferencesStore();
          await preferences.loadMarkdownPreferences();
          const html = await renderMarkdown(content, { ...preferences.markdown });
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
      this.headings = [];
      this.segmentHeadings = [];
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
      if (!this.navigatingToHeading) this.editor?.commands.focus(focusPosition);
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

    async navigateToHeading(heading: Heading): Promise<boolean> {
      if (!this.editor || this.loading || this.renderingDocument || this.navigatingToHeading) return false;
      if (heading.segmentIndex < 0 || heading.segmentIndex >= this.segmentCount) return false;
      this.navigatingToHeading = true;
      let version = this.renderVersion;
      try {
        if (this.segmented && heading.segmentIndex !== this.segmentIndex) {
          version += 1;
          if (!await this.showSegment(heading.segmentIndex)) return false;
          await nextTick();
        }
        if (!this.editor || version !== this.renderVersion || this.renderingDocument || this.segmentIndex !== heading.segmentIndex) return false;
        let headingIndex = 0;
        let position: number | undefined;
        this.editor.state.doc.descendants((node, pos) => {
          if (node.type.name !== 'heading') return;
          if (headingIndex === heading.headingIndex) position = pos + 1;
          headingIndex += 1;
        });
        if (position === undefined) return false;
        const navigated = this.editor.chain()
          .focus(undefined, { scrollIntoView: false })
          .setTextSelection(position)
          .scrollIntoView()
          .run();
        if (!navigated) return false;
        const scrollContainer = this.editor.view.dom.closest('.el-scrollbar__wrap') as HTMLElement | null;
        const navigation = scrollContainer?.querySelector<HTMLElement>('.segment-navigation');
        const target = this.editor.view.nodeDOM(position - 1);
        if (scrollContainer && navigation && target instanceof HTMLElement) {
          const overlap = navigation.getBoundingClientRect().bottom + 8 - target.getBoundingClientRect().top;
          if (overlap > 0) scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - overlap);
        }
        return true;
      } catch (error) {
        appLog.error(`heading navigation failed: ${String(error)}`);
        return false;
      } finally {
        this.navigatingToHeading = false;
      }
    },

    readMarkdownHeadings(content: string, segmentIndex: number): OutlineHeading[] {
      return collectMarkdownHeadings(content, segmentIndex, this.editor.storage.markdown.parser.md, html => {
        const body = new window.DOMParser().parseFromString(html, 'text/html').body;
        return Array.from(body.querySelectorAll('h1,h2,h3,h4,h5,h6'))
          .filter(element => !element.closest('pre,code,script,style,template'))
          .map(element => {
            // These inline atom nodes contribute no text to a ProseMirror heading.
            element.querySelectorAll('img,span.katex').forEach(atom => atom.remove());
            return { level: Number(element.tagName.substring(1)), text: element.textContent || '' };
          });
      });
    },

    reindexOtherSegments() {
      if (!this.editor || !this.segmented || this.renderingDocument) return;
      // Cancel a segment load that started with the previous parsing options.
      // The current document remains intact, including pending edits and history.
      this.renderVersion += 1;
      const current = this.headings.filter(heading => heading.segmentIndex === this.segmentIndex);
      const identity = (heading: OutlineHeading) => JSON.stringify([heading.segmentIndex, heading.level, heading.text]);
      const previous = new Map<string, Heading[]>();
      for (const heading of this.headings) {
        if (heading.segmentIndex === this.segmentIndex) continue;
        const key = identity(heading);
        const matches = previous.get(key) || [];
        matches.push(heading);
        previous.set(key, matches);
      }
      const indexed = this.segments.map((content, index) => index === this.segmentIndex
        ? current.map(({ status: _status, show: _show, ...heading }) => heading)
        : this.readMarkdownHeadings(content, index));
      const counts = new Map<string, number>();
      for (const headings of indexed) {
        for (const heading of headings) {
          const key = identity(heading);
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
      const retained = [...current];
      for (const headings of indexed) {
        for (const heading of headings) {
          if (heading.segmentIndex === this.segmentIndex) continue;
          const matches = previous.get(identity(heading));
          // Ordinals can change when HTML headings disappear. Only reuse an
          // unambiguous content identity, so a removed heading cannot lend its
          // collapse state to a different heading at its former index.
          const status = matches?.length === 1 && counts.get(identity(heading)) === 1
            ? matches[0].status : 'open';
          retained.push({ ...heading, status, show: true });
        }
      }
      this.segmentHeadings = indexed;
      this.headings = mergeOutlineHeadings(indexed, retained);
    },

    updateHeadings() {
      if (!this.editor || this.renderingDocument) return;
      const items: OutlineHeading[] = [];
      const previous = new Map(this.headings.filter(heading => heading.segmentIndex === this.segmentIndex).map(heading => [heading.id, heading]));
      const retained: Heading[] = [];
      let retainsNodeIds = false;
      const transaction = this.editor.state.tr;

      if (this.segmented && this.segmentHeadings.length !== this.segments.length) {
        this.segmentHeadings = this.segments.map((content, index) => index === this.segmentIndex ? [] : this.readMarkdownHeadings(content, index));
      }

      this.editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const headingIndex = items.length;
          const id = headingId(this.segmentIndex, headingIndex);
          const oldHeading = previous.get(node.attrs.id);
          if (oldHeading) retainsNodeIds = true;
          if (node.attrs.id !== id) {
            transaction.setNodeMarkup(pos, undefined, { ...node.attrs, id });
          }
          const item = {
            level: node.attrs.level,
            text: node.textContent,
            id,
            segmentIndex: this.segmentIndex,
            headingIndex,
          };
          items.push(item);
          retained.push({ ...item, status: oldHeading?.status || 'open', show: true });
        }
      });

      if (transaction.docChanged) {
        transaction.setMeta('addToHistory', false);
        transaction.setMeta('preventUpdate', true);
        this.editor.view.dispatch(transaction);
      }
      if (this.segmented) {
        this.segmentHeadings[this.segmentIndex] = items;
        const statuses = retainsNodeIds
          ? [...this.headings.filter(heading => heading.segmentIndex !== this.segmentIndex), ...retained]
          : this.headings;
        this.headings = mergeOutlineHeadings(this.segmentHeadings, statuses);
      } else {
        this.headings = mergeOutlineHeadings([items], retainsNodeIds ? retained : this.headings);
      }
    },
  },
});
