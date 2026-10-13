import { Editor } from '@tiptap/vue-3';
import { EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import { defineStore } from 'pinia';
import { markRaw, nextTick, shallowRef, type Ref } from 'vue';
import * as appLog from '@tauri-apps/plugin-log';
import { isTauri } from '@tauri-apps/api/core';
import { renderMarkdown } from '../api/utils';
import { usePreferencesStore } from './preferences';
import { applyMarkdownPreferencesToEditor } from '../utils/markdownPreferences';
import {
  LARGE_FILE_THRESHOLD,
  markdownReferenceDefinitions,
  preserveBoundaryNewlines,
  preserveMarkdownReferences,
  prepareMarkdownSegments,
  utf8ByteLength,
  withMarkdownReferences,
} from '../utils/largeFile';
import { collectMarkdownHeadings, headingId, mergeOutlineHeadings, type Heading, type OutlineHeading } from '../utils/outline';
import { changedBlockNodes, changedDocumentRanges } from '../utils/editorTransactions';
import { EditorStatisticsCache, type DocumentStatistics } from '../utils/editorStatistics';
import { SegmentEditorCache } from '../utils/segmentCache';
import { rebaseMarkdownAttachments, rebaseMarkdownAttachmentOffsets } from '../utils/attachments';
import { SourceDocument, type SourceMode, type SourceReplacement, type SourceSelection } from '../utils/sourceDocument';
import { useAppStore } from './app';

export { LARGE_FILE_THRESHOLD } from '../utils/largeFile';
export type { Heading } from '../utils/outline';

const editorRef = shallowRef<Editor>();
interface SegmentPosition { anchor: number; head: number; scrollTop: number; }
export type SourceCommand = 'undo' | 'redo' | 'selectAll' | 'copy' | 'cut' | 'paste';
interface SourceHandlers { focus(): void; command(action: SourceCommand): Promise<boolean>; }
let sourceHandlers: SourceHandlers | null = null;

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
    referenceDefinitions: string,
    segmentIndex: number,
    segmentDirty: boolean,
    pendingContent: string | null,
    renderVersion: number,
    segmentRenderVersion: number | null,
    renderingDocument: boolean,
    documentGeneration: number,
    segmentEditorCache: SegmentEditorCache,
    segmentPositions: (SegmentPosition | undefined)[],
    currentStatistics: DocumentStatistics,
    segmentStatistics: (DocumentStatistics | null)[],
    statisticsCache: EditorStatisticsCache,
    statisticsScope: 'document' | 'segment',
    statisticsPending: boolean,
    statisticsError: boolean,
    statisticsIndexVersion: number,
    attachmentMapping: Record<string, string>,
    attachmentMappingVersion: number,
    attachmentMemo: { raw: string; result: string; version: number; parsingOptions: string } | null,
    sourceDocument: SourceDocument,
    sourceMode: SourceMode,
    sourceVersion: number,
    sourceSwitching: boolean,
    sourceComposing: boolean,
    sourceSwitchError: boolean,
    sourceEditable: boolean,
    wysiwygRevision: number,
    sourceReturnScroll: number,
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
      referenceDefinitions: '',
      segmentIndex: 0,
      segmentDirty: false,
      pendingContent: null,
      renderVersion: 0,
      segmentRenderVersion: null,
      renderingDocument: false,
      documentGeneration: 0,
      segmentEditorCache: markRaw(new SegmentEditorCache()),
      segmentPositions: [],
      currentStatistics: { characters: 0, words: 0 },
      segmentStatistics: [],
      statisticsCache: markRaw(new EditorStatisticsCache()),
      statisticsScope: localStorage.getItem('statisticsScope') === 'segment' ? 'segment' : 'document',
      statisticsPending: false,
      statisticsError: false,
      statisticsIndexVersion: 0,
      attachmentMapping: Object.create(null),
      attachmentMappingVersion: 0,
      attachmentMemo: null,
      sourceDocument: markRaw(new SourceDocument()),
      sourceMode: 'wysiwyg',
      sourceVersion: 0,
      sourceSwitching: false,
      sourceComposing: false,
      sourceSwitchError: false,
      sourceEditable: true,
      wysiwygRevision: 0,
      sourceReturnScroll: 0,
    }
  },

  getters: {
    editor(): Editor {
      return editorRef.value as Editor;
    },
    segmentCount(): number {
      return this.segmented ? this.segments.length : 1;
    },
    segmentLoading(): boolean {
      return this.segmentRenderVersion !== null || this.sourceSwitching;
    },
    sourceText(): string { this.sourceVersion; return this.sourceDocument.text; },
    sourceSelection(): SourceSelection { this.sourceVersion; return this.sourceDocument.selection; },
    sourceStatistics(): DocumentStatistics {
      this.sourceVersion;
      return this.sourceDocument.statistics();
    },
    documentStatistics(): DocumentStatistics | null {
      if (!this.segmented) return this.currentStatistics;
      if (this.statisticsError || this.segmentStatistics.length !== this.segments.length || this.segmentStatistics.some(statistics => !statistics)) return null;
      return this.segmentStatistics.reduce<DocumentStatistics>((total, statistics) => ({ characters: total.characters + statistics!.characters, words: total.words + statistics!.words }), { characters: 0, words: 0 });
    },
  },

  actions: {
    setEditor(editor: Editor | undefined) {
      if (editorRef.value !== editor) {
        this.renderVersion += 1;
        this.segmentEditorCache = markRaw(new SegmentEditorCache());
      }
      editorRef.value = editor;
      if (editor) {
        applyMarkdownPreferencesToEditor(editor, usePreferencesStore().markdown);
        // A startup file can be segmented before the editor (and its math
        // plugin) exists. Rebuild reference context with the actual parser.
        if (this.segmented && this.pendingContent !== null) {
          this.referenceDefinitions = markdownReferenceDefinitions(this.segments.join(''), editor.storage.markdown.parser.md);
        }
      }
    },
    applyEditorState(state: EditorState) {
      const editor = this.editor;
      (editor as unknown as { reactiveState: Ref<EditorState> }).reactiveState.value = state;
      editor.view.updateState(state);
    },
    replaceEditorDocument(body: HTMLElement) {
      const editor = this.editor;
      if (!editor) {
        appLog.error(`editor unavailable while loading ${body.textContent?.length || 0} characters`);
        return;
      }
      const doc = ProseMirrorDOMParser.fromSchema(editor.schema).parse(body);
      doc.check();
      // A new document or an evicted segment starts with fresh plugin history.
      const current = editor.view.state;
      const state = EditorState.create({
        schema: current.schema,
        doc,
        plugins: current.plugins,
      });
      // Tiptap's Vue editor reads from reactiveState in dispatchTransaction.
      // Keep it in sync before node views can dispatch while updateState runs.
      this.applyEditorState(state);
    },

    async renderEditorBody(content: string): Promise<HTMLElement> {
      const parser = this.editor.storage.markdown.parser;
      if (!content) return new window.DOMParser().parseFromString('<body></body>', 'text/html').body;
      const renderContent = withMarkdownReferences(content, this.segmented ? this.referenceDefinitions : '');
      if (isTauri()) {
        try {
          const preferences = usePreferencesStore();
          await preferences.loadMarkdownPreferences();
          const html = await renderMarkdown(renderContent, { ...preferences.markdown });
          return parser.parseRenderedDom(html, { content: renderContent });
        } catch (error) {
          appLog.error(`Rust Markdown rendering failed: ${String(error)}`);
        }
      }
      const html = parser.parse(renderContent);
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
        this.updateCurrentStatistics();
        void this.indexDocumentStatistics();
      } catch (error) {
        if (version === this.renderVersion) {
          appLog.error(`editor document rendering failed: ${String(error)}`);
        }
        throw error;
      }
    },

    async setContent(content: string) {
      ++this.renderVersion;
      this.documentGeneration += 1;
      this.statisticsIndexVersion += 1;
      this.segmentEditorCache = markRaw(new SegmentEditorCache());
      this.segmentPositions = [];
      this.statisticsCache = markRaw(new EditorStatisticsCache());
      this.currentStatistics = { characters: 0, words: 0 };
      this.segmentStatistics = [];
      this.statisticsPending = false;
      this.statisticsError = false;
      this.attachmentMapping = Object.create(null);
      this.attachmentMappingVersion += 1;
      this.attachmentMemo = null;
      this.sourceDocument = markRaw(new SourceDocument(content));
      this.sourceVersion += 1;
      this.wysiwygRevision = 0;
      this.sourceSwitching = false;
      this.sourceComposing = false;
      this.sourceSwitchError = false;
      this.sourceReturnScroll = 0;
      this.segmentRenderVersion = null;
      this.renderingDocument = true;
      this.segmented = utf8ByteLength(content) >= LARGE_FILE_THRESHOLD;
      const prepared = this.segmented ? prepareMarkdownSegments(content, undefined, this.editor?.storage.markdown.parser.md) : null;
      this.segments = prepared?.segments || [];
      this.referenceDefinitions = prepared?.references || '';
      this.segmentStatistics = this.segments.map(() => null);
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
      this.wysiwygRevision += 1;
    },
    registerSourceHandlers(handlers: SourceHandlers | null) { sourceHandlers = handlers; },
    sourceOperationBlocked() {
      const app = useAppStore();
      return app.lifecycleBusy || app.saving || app.exporting || app.loading || this.loading || this.renderingDocument || this.segmentLoading || this.sourceComposing || Boolean(this.editor?.view.composing);
    },
    async setSourceMode(mode: SourceMode): Promise<boolean> {
      if (mode === this.sourceMode) return true;
      if (!this.editor || this.sourceOperationBlocked() || useAppStore().resourceTasks > 0) return false;
      this.sourceSwitchError = false;
      if (mode !== 'wysiwyg') {
        const markdown = this.getMarkdown();
        if (typeof markdown !== 'string') return false;
        if (this.sourceMode === 'wysiwyg') this.sourceDocument.renderedText = markdown;
        this.sourceDocument.synchronize(markdown, this.sourceDocument.selection);
        this.sourceDocument.syncedWysRevision = this.wysiwygRevision;
        this.sourceVersion += 1;
        if (this.sourceMode === 'wysiwyg') {
          // Source statistics use the raw buffer; pause detached rendered
          // statistics instead of parsing unopened segments behind this pane.
          this.statisticsIndexVersion += 1; this.statisticsPending = false;
          this.sourceEditable = this.editor.isEditable;
          const scroll = this.editor.view.dom.closest('.el-scrollbar__wrap') as HTMLElement | null;
          this.sourceReturnScroll = scroll?.scrollTop || 0;
          this.editor.setEditable(false, false);
        }
        this.sourceMode = mode;
        await nextTick(); sourceHandlers?.focus();
        return true;
      }
      if (this.sourceDocument.text === this.sourceDocument.renderedText && this.sourceDocument.syncedWysRevision === this.wysiwygRevision) {
        this.sourceMode = mode; this.editor.setEditable(this.sourceEditable, false);
        void this.indexDocumentStatistics();
        await nextTick(); this.editor.view.focus();
        const scroll = this.editor.view.dom.closest('.el-scrollbar__wrap') as HTMLElement | null;
        if (scroll) scroll.scrollTop = this.sourceReturnScroll;
        return true;
      }
      const editor = this.editor, document = this.sourceDocument;
      const sourceRevision = document.revision, generation = this.documentGeneration;
      const version = ++this.renderVersion;
      this.sourceSwitching = true;
      try {
        // Prepare the replacement offscreen. Never clear source/history before
        // the rendered document has parsed and checked successfully.
        const markdown = this.getMarkdown()!;
        const segmented = utf8ByteLength(markdown) >= LARGE_FILE_THRESHOLD;
        const prepared = segmented ? prepareMarkdownSegments(markdown, undefined, editor.storage.markdown.parser.md) : null;
        const references = prepared?.references || '';
        const content = prepared?.segments[0] ?? markdown;
        const html = editor.storage.markdown.parser.parse(withMarkdownReferences(content, references));
        await nextTick();
        const body = new window.DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
        const doc = ProseMirrorDOMParser.fromSchema(editor.schema).parse(body); doc.check();
        const state = EditorState.create({ schema: editor.schema, doc, plugins: editor.state.plugins });
        if (version !== this.renderVersion || generation !== this.documentGeneration || document !== this.sourceDocument || sourceRevision !== document.revision || editor !== this.editor) return false;
        this.segmented = segmented; this.segments = prepared?.segments || []; this.referenceDefinitions = references;
        this.segmentIndex = 0; this.segmentDirty = false; this.segmentHeadings = []; this.headings = [];
        this.segmentEditorCache = markRaw(new SegmentEditorCache()); this.segmentPositions = [];
        this.statisticsIndexVersion += 1; this.statisticsCache = markRaw(new EditorStatisticsCache());
        this.segmentStatistics = this.segments.map(() => null);
        this.applyEditorState(state);
        document.synchronize(markdown, document.selection); document.renderedText = markdown;
        document.syncedWysRevision = this.wysiwygRevision; this.sourceVersion += 1;
        this.sourceMode = mode; editor.setEditable(this.sourceEditable, false);
        this.updateHeadings(); this.updateCurrentStatistics(); void this.indexDocumentStatistics();
        await nextTick(); editor.view.focus();
        const scroll = editor.view.dom.closest('.el-scrollbar__wrap') as HTMLElement | null;
        if (scroll) scroll.scrollTop = 0;
        return true;
      } catch (error) {
        if (version === this.renderVersion) { this.sourceSwitchError = true; appLog.error(`source rendering failed: ${String(error)}`); }
        return false;
      } finally { if (version === this.renderVersion) this.sourceSwitching = false; }
    },
    updateSource(text: string, selection: SourceSelection, group = ''): boolean {
      if (this.sourceMode === 'wysiwyg' || !this.sourceEditable || (this.sourceOperationBlocked() && !this.sourceComposing)) return false;
      // Composition itself may update the buffer; lifecycle actions remain
      // blocked until compositionend supplies the final committed text.
      if (useAppStore().lifecycleBusy || useAppStore().saving || useAppStore().exporting || this.sourceSwitching) return false;
      if (!this.sourceDocument.apply(text, selection, group)) return false;
      this.sourceVersion += 1; this.sourceSwitchError = false; useAppStore().markEdited(); return true;
    },
    undoSource(): boolean {
      if (this.sourceMode === 'wysiwyg' || this.sourceOperationBlocked() || !this.sourceEditable || !this.sourceDocument.undo()) return false;
      this.sourceVersion += 1; this.sourceSwitchError = false; useAppStore().markEdited(); return true;
    },
    redoSource(): boolean {
      if (this.sourceMode === 'wysiwyg' || this.sourceOperationBlocked() || !this.sourceEditable || !this.sourceDocument.redo()) return false;
      this.sourceVersion += 1; this.sourceSwitchError = false; useAppStore().markEdited(); return true;
    },
    async runSourceCommand(action: SourceCommand): Promise<boolean> {
      if (this.sourceMode === 'wysiwyg' || this.sourceOperationBlocked()) return false;
      if (action === 'undo' || action === 'redo') { const result = action === 'undo' ? this.undoSource() : this.redoSource(); await nextTick(); sourceHandlers?.focus(); return result; }
      return sourceHandlers?.command(action) || false;
    },
    async openSourceRange(from: number, to: number, expectedMarkdown?: string): Promise<boolean> {
      if (this.sourceOperationBlocked()) return false;
      const markdown = this.getMarkdown();
      if (typeof markdown !== 'string' || (expectedMarkdown !== undefined && expectedMarkdown !== markdown) || from < 0 || to < from || to > markdown.length) return false;
      if (this.sourceMode === 'wysiwyg' && !await this.setSourceMode('source')) return false;
      if (this.getMarkdown() !== markdown) return false;
      this.sourceDocument.synchronize(markdown, this.sourceDocument.selection);
      this.sourceDocument.boundary(); this.sourceDocument.setSelection({ from, to, direction: 'forward' });
      this.sourceVersion += 1; await nextTick(); sourceHandlers?.focus(); return true;
    },
    focusSourceRange(from: number, to: number): Promise<boolean> { return this.openSourceRange(from, to); },
    hasSourceSelection(): boolean { return this.sourceSelection.from !== this.sourceSelection.to; },
    updateSourceSelection(selection: SourceSelection, scrollTop?: number) {
      this.sourceDocument.setSelection(selection);
      if (scrollTop !== undefined) this.sourceDocument.scrollTop = scrollTop;
      this.sourceVersion += 1;
    },
    async replaceSourceRanges(ranges: SourceReplacement[], expectedMarkdown: string): Promise<boolean> {
      if (!ranges.length || this.sourceOperationBlocked() || this.getMarkdown() !== expectedMarkdown) return false;
      if (!await this.openSourceRange(ranges[0].from, ranges[0].to, expectedMarkdown) || !this.sourceEditable) return false;
      if (!this.sourceDocument.replace(ranges)) return false;
      this.sourceVersion += 1; this.sourceSwitchError = false; useAppStore().markEdited(); await nextTick(); sourceHandlers?.focus(); return true;
    },
    setStatisticsScope(scope: 'document' | 'segment') {
      this.statisticsScope = scope;
      localStorage.setItem('statisticsScope', scope);
    },
    updateCurrentStatistics(transaction?: Transaction) {
      if (!this.editor || this.renderingDocument || (transaction && !transaction.docChanged)) return;
      if (typeof this.editor.state.doc.forEach !== 'function') return;
      this.currentStatistics = this.statisticsCache.count(this.editor.state.doc);
      if (this.segmented) this.segmentStatistics[this.segmentIndex] = this.currentStatistics;
    },
    async indexDocumentStatistics() {
      if (!this.editor || !this.segmented || this.renderingDocument) return;
      const version = ++this.statisticsIndexVersion;
      const generation = this.documentGeneration;
      const editor = this.editor;
      this.statisticsPending = true;
      this.statisticsError = false;
      try {
        for (let index = 0; index < this.segments.length; index += 1) {
          if (this.segmentStatistics[index]) continue;
          // Build at most one offline PM document per frame. No editor state,
          // history, node views or highlighter is created for unopened segments.
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (version !== this.statisticsIndexVersion || generation !== this.documentGeneration || editor !== this.editor) return;
          if (index === this.segmentIndex) { this.updateCurrentStatistics(); continue; }
          const parser = editor.storage.markdown.parser;
          const content = withMarkdownReferences(this.segments[index], this.referenceDefinitions);
          const body = new window.DOMParser().parseFromString(`<body>${parser.parse(content)}</body>`, 'text/html').body;
          const doc = ProseMirrorDOMParser.fromSchema(editor.schema).parse(body);
          this.segmentStatistics[index] = this.statisticsCache.count(doc);
        }
      } catch (error) {
        if (version === this.statisticsIndexVersion) {
          this.statisticsError = true;
          appLog.error(`document statistics failed: ${String(error)}`);
        }
      } finally {
        if (version === this.statisticsIndexVersion) this.statisticsPending = false;
      }
    },
    rememberCurrentSegment() {
      const state = this.editor?.state;
      if (!state || !Array.isArray(state.plugins)) return;
      const scroll = this.editor.view.dom.closest('.el-scrollbar__wrap') as HTMLElement | null;
      this.segmentPositions[this.segmentIndex] = { anchor: state.selection.anchor, head: state.selection.head, scrollTop: scroll?.scrollTop || 0 };
      this.segmentEditorCache.put(this.segmentIndex, state);
    },
    segmentCacheInfo() { return this.segmentEditorCache.snapshot(); },
    setAttachmentMapping(mapping: Record<string, string>) {
      const updated: Record<string, string> = Object.create(null);
      const destination = (source: string) => Object.prototype.hasOwnProperty.call(mapping, source) ? mapping[source] : source;
      for (const [source, target] of Object.entries(this.attachmentMapping)) updated[source] = destination(target);
      Object.assign(updated, mapping);
      for (const [source, target] of Object.entries(updated)) if (source === target) delete updated[source];
      this.attachmentMapping = updated;
      this.attachmentMappingVersion += 1;
      this.attachmentMemo = null;
      const parser = this.editor?.storage.markdown.parser.md;
      this.sourceDocument.rewrite(text => rebaseMarkdownAttachments(text, this.attachmentMapping, parser),
        (text, offsets) => rebaseMarkdownAttachmentOffsets(text, this.attachmentMapping, offsets, parser));
      this.sourceVersion += 1;
    },

    commitCurrentSegment() {
      if (!this.segmented || !this.segmentDirty || !this.editor) return;
      const markdown = this.editor.storage.markdown.getMarkdown();
      this.segments[this.segmentIndex] = preserveBoundaryNewlines(
        preserveMarkdownReferences(markdown, this.segments[this.segmentIndex], this.editor.storage.markdown.parser.md),
        this.segments[this.segmentIndex],
      );
      this.segmentDirty = false;
    },

    async showSegment(index: number, focusPosition: 'start' | 'end' | 'restore' = 'restore'): Promise<boolean> {
      if (this.sourceMode !== 'wysiwyg' || !this.segmented || this.segmentLoading || this.renderingDocument || index < 0 || index >= this.segments.length || index === this.segmentIndex) return false;
      const version = ++this.renderVersion;
      this.segmentRenderVersion = version;
      try {
        const cached = this.segmentEditorCache.peek(index);
        const body = cached ? null : await this.renderEditorBody(this.segments[index]);
        if (version !== this.renderVersion || !this.editor || !this.segmented) return false;
        this.commitCurrentSegment();
        this.rememberCurrentSegment();
        this.segmentEditorCache.delete(index);
        this.segmentIndex = index;
        this.segmentDirty = false;
        if (cached) this.applyEditorState(cached);
        else this.replaceEditorDocument(body!);
        // Search storage is shared by the editor; refresh its positions after
        // restoring a segment's otherwise intact plugin/history state.
        if (typeof this.editor.storage.searchAndReplace?.searchTerm === 'string') {
          this.editor.commands.setSearchTerm(this.editor.storage.searchAndReplace.searchTerm);
        }
        const bookmark = this.segmentPositions[index];
        const doc = this.editor.state.doc;
        if (!this.navigatingToHeading && typeof doc.resolve === 'function') {
          if (focusPosition === 'restore' && bookmark && !cached) {
            const anchor = Math.max(0, Math.min(doc.content.size, bookmark.anchor));
            const head = Math.max(0, Math.min(doc.content.size, bookmark.head));
            this.editor.view.dispatch(this.editor.state.tr.setSelection(TextSelection.between(doc.resolve(anchor), doc.resolve(head))).setMeta('addToHistory', false));
          } else if (focusPosition !== 'restore' || !bookmark) {
            this.editor.view.dispatch(this.editor.state.tr.setSelection(focusPosition === 'end' ? TextSelection.atEnd(doc) : TextSelection.atStart(doc)).setMeta('addToHistory', false));
          }
        }
        this.updateHeadings();
        this.updateCurrentStatistics();
        if (!this.navigatingToHeading) {
          const editor = this.editor;
          if (typeof this.editor.view.focus === 'function') this.editor.view.focus();
          else this.editor.commands.focus(focusPosition === 'restore' ? undefined : focusPosition);
          await nextTick();
          if (version !== this.renderVersion || editor !== this.editor) return false;
          const scroll = this.editor.view.dom.closest('.el-scrollbar__wrap') as HTMLElement | null;
          if (scroll) scroll.scrollTop = focusPosition === 'restore' && bookmark ? bookmark.scrollTop : focusPosition === 'end' ? scroll.scrollHeight : 0;
        }
        return true;
      } catch (error) {
        if (version === this.renderVersion) appLog.error('segment rendering failed: ' + String(error));
        return false;
      } finally {
        if (this.segmentRenderVersion === version) this.segmentRenderVersion = null;
      }
    },

    getMarkdown(): string | undefined {
      if (!this.editor || this.renderingDocument) return undefined;
      const sourceCurrent = this.sourceMode !== 'wysiwyg' || this.sourceDocument.syncedWysRevision === this.wysiwygRevision;
      if (!sourceCurrent && this.segmented) this.commitCurrentSegment();
      const raw = sourceCurrent ? this.sourceDocument.text : this.segmented ? this.segments.join('') : this.editor.storage.markdown.getMarkdown();
      if (!Object.keys(this.attachmentMapping).length) return raw;
      const parser = this.editor.storage.markdown.parser.md;
      const parsingOptions = JSON.stringify(parser?.options || null);
      const memo = this.attachmentMemo;
      if (memo && memo.raw === raw && memo.version === this.attachmentMappingVersion && memo.parsingOptions === parsingOptions) return memo.result;
      const result = rebaseMarkdownAttachments(raw, this.attachmentMapping, parser);
      this.attachmentMemo = { raw, result, version: this.attachmentMappingVersion, parsingOptions };
      return result;
    },

    focus() {
      if (this.sourceMode !== 'wysiwyg') sourceHandlers?.focus();
      else this.editor?.commands.focus();
    },

    async navigateToHeading(heading: Heading): Promise<boolean> {
      if (this.sourceMode !== 'wysiwyg' && !await this.setSourceMode('wysiwyg')) return false;
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
      return collectMarkdownHeadings(withMarkdownReferences(content, this.referenceDefinitions), segmentIndex, this.editor.storage.markdown.parser.md, html => {
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
      this.attachmentMemo = null;
      if (!this.editor || !this.segmented || this.renderingDocument) return;
      // Cancel a segment load that started with the previous parsing options.
      // The current document remains intact, including pending edits and history.
      this.renderVersion += 1;
      // Newly loaded segments must use the new parsing preferences. Keep the
      // current state/history, while retaining numeric bookmarks for others.
      this.segmentEditorCache = markRaw(new SegmentEditorCache());
      this.statisticsIndexVersion += 1;
      this.segmentStatistics = this.segments.map((_, index) => index === this.segmentIndex ? this.currentStatistics : null);
      this.referenceDefinitions = markdownReferenceDefinitions(this.segments.join(''), this.editor.storage.markdown.parser.md);
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
      void this.indexDocumentStatistics();
    },

    updateHeadings(event?: { transaction?: Transaction }) {
      if (!this.editor || this.renderingDocument) return;
      if (event?.transaction) {
        const changed = event.transaction;
        if (!changed.docChanged) return;
        const ranges = changedDocumentRanges(changed);
        const oldHeadings = changedBlockNodes(changed.before, ranges.map(range => ({ from: range.oldFrom, to: range.oldTo })), 'heading');
        const newHeadings = changedBlockNodes(changed.doc, ranges, 'heading');
        if (!oldHeadings.length && !newHeadings.length) return;
        // Text/mark edits preserve heading order and hierarchy. Update only
        // those labels; prose/code edits do not rebuild the outline at all.
        if (oldHeadings.length === newHeadings.length && newHeadings.every((heading, index) => heading.node.attrs.id && heading.node.attrs.id === oldHeadings[index].node.attrs.id && heading.node.attrs.level === oldHeadings[index].node.attrs.level)) {
          for (const heading of newHeadings) {
            const item = this.headings.find(item => item.id === heading.node.attrs.id && item.segmentIndex === this.segmentIndex);
            if (item) item.text = heading.node.textContent;
            const indexed = this.segmentHeadings[this.segmentIndex]?.find(item => item.id === heading.node.attrs.id);
            if (indexed) indexed.text = heading.node.textContent;
          }
          return;
        }
      }
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
