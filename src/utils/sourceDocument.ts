export type SourceMode = 'wysiwyg' | 'source' | 'split';
export interface SourceSelection { from: number; to: number; direction: 'forward' | 'backward' | 'none'; }
export interface SourceReplacement { from: number; to: number; replacement: string; }
interface SourceEdit { from: number; removed: string; inserted: string; }
interface SourceChange extends SourceEdit { batch?: SourceEdit[]; before: SourceSelection; after: SourceSelection; }
export const SOURCE_DOCUMENT_MAX_BYTES = 128 * 1024 * 1024;
export const SOURCE_HISTORY_BYTE_LIMIT = 8 * 1024 * 1024;
export function sourceReplacementHistoryBytes(text: string, ranges: SourceReplacement[]): number {
  return ranges.reduce((size, range) => {
    const removed = text.slice(range.from, range.to);
    return removed === range.replacement ? size : size + 48 + (removed.length + range.replacement.length) * 2;
  }, 48);
}
export function sourceReplacementLimit(text: string, ranges: SourceReplacement[], historyByteLimit = SOURCE_HISTORY_BYTE_LIMIT, maxBytes = SOURCE_DOCUMENT_MAX_BYTES): 'range' | 'document' | 'history' | null {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  if (sorted.some((range, index) => !Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 0 || range.to < range.from || range.to > text.length || (index > 0 && range.from < sorted[index - 1].to))) return 'range';
  const encoder = new TextEncoder(); let bytes = encoder.encode(text).length;
  for (const range of sorted) {
    const removed = text.slice(range.from, range.to);
    bytes += encoder.encode(range.replacement).length - encoder.encode(removed).length;
  }
  return bytes > maxBytes ? 'document' : sourceReplacementHistoryBytes(text, sorted) > historyByteLimit ? 'history' : null;
}
const emptySelection = (): SourceSelection => ({ from: 0, to: 0, direction: 'none' });
export const sourceTextareaValue = (text: string): string => text.replace(/\r\n?/g, '\n');
export const sourceOffsetToTextarea = (text: string, offset: number): number => sourceTextareaValue(text.slice(0, offset)).length;
export function textareaOffsetToSource(text: string, offset: number): number {
  let raw = 0, visible = 0;
  while (raw < text.length && visible < offset) { if (text[raw] === '\r' && text[raw + 1] === '\n') raw++; raw++; visible++; }
  return raw;
}
/** Native textareas normalize CRLF; splice only the changed visible range. */
export function sourceTextareaInput(text: string, value: string, selection: SourceSelection): { text: string; selection: SourceSelection } {
  const visible = sourceTextareaValue(text);
  let from = 0, oldEnd = visible.length, newEnd = value.length;
  while (from < oldEnd && from < newEnd && visible[from] === value[from]) from++;
  while (oldEnd > from && newEnd > from && visible[oldEnd - 1] === value[newEnd - 1]) { oldEnd--; newEnd--; }
  const ending = text.match(/\r\n|\r|\n/)?.[0] || '\n';
  const inserted = value.slice(from, newEnd).replace(/\n/g, ending);
  const result = text.slice(0, textareaOffsetToSource(text, from)) + inserted + text.slice(textareaOffsetToSource(text, oldEnd));
  return { text: result, selection: { ...selection, from: textareaOffsetToSource(result, selection.from), to: textareaOffsetToSource(result, selection.to) } };
}

/** A document's raw text and bounded, independent undo history. Offsets are UTF16. */
export class SourceDocument {
  text: string;
  renderedText: string;
  syncedWysRevision = 0;
  revision = 0;
  selection = emptySelection();
  scrollTop = 0;
  private past: SourceChange[] = [];
  private future: SourceChange[] = [];
  private group = '';
  private groupTime = 0;
  private bytes = 0;
  private indexedText = '';
  private starts = [0];
  private countedText: string | null = null;
  private counts = { characters: 0, words: 0 };

  constructor(text = '', readonly historyLimit = 100, readonly historyByteLimit = SOURCE_HISTORY_BYTE_LIMIT) {
    this.text = this.renderedText = text;
  }
  get undoAvailable() { return this.past.length > 0; }
  get redoAvailable() { return this.future.length > 0; }
  historyInfo() { return { undo: this.past.length, redo: this.future.length, bytes: this.bytes }; }
  statistics(): { characters: number; words: number } {
    if (this.countedText !== this.text) {
      let words = 0, inWord = false;
      for (let index = 0; index < this.text.length; index++) { const next = this.text[index] !== ' '; if (next && !inWord) words++; inWord = next; }
      this.counts = { characters: this.text.length, words }; this.countedText = this.text;
    }
    return this.counts;
  }
  setSelection(selection: SourceSelection) {
    this.selection = { from: Math.max(0, Math.min(this.text.length, selection.from)), to: Math.max(0, Math.min(this.text.length, selection.to)), direction: selection.direction };
  }
  boundary() { this.group = ''; }
  synchronize(text: string, selection: SourceSelection = this.selection): void {
    if (text === this.text || this.apply(text, selection)) return;
    // A very large WYSIWYG rewrite may exceed source-history's memory budget.
    // Still adopt the canonical document, releasing the old bounded branch.
    this.text = text; this.setSelection(selection); this.past = []; this.future = []; this.bytes = 0; this.revision++; this.boundary();
  }
  apply(text: string, selection: SourceSelection, group = '', now = Date.now()): boolean {
    if (text === this.text) { this.setSelection(selection); return false; }
    if (text.length > SOURCE_DOCUMENT_MAX_BYTES / 3 && new TextEncoder().encode(text).length > SOURCE_DOCUMENT_MAX_BYTES) return false;
    let from = 0;
    const old = this.text;
    while (from < old.length && from < text.length && old[from] === text[from]) from++;
    let oldEnd = old.length, newEnd = text.length;
    while (oldEnd > from && newEnd > from && old[oldEnd - 1] === text[newEnd - 1]) { oldEnd--; newEnd--; }
    let change: SourceChange = { from, removed: old.slice(from, oldEnd), inserted: text.slice(from, newEnd), before: { ...this.selection }, after: { ...selection } };
    if (this.changeBytes(change) > this.historyByteLimit) return false;
    const previous = this.past[this.past.length - 1];
    if (group && group === this.group && now - this.groupTime <= 700 && !this.future.length && previous && !previous.batch) {
      // Compose the last local input group from its original text. Keeping one
      // diff avoids retaining the complete document for every keystroke.
      const before = old.slice(0, previous.from) + previous.removed + old.slice(previous.from + previous.inserted.length);
      let start = 0;
      while (start < before.length && start < text.length && before[start] === text[start]) start++;
      let a = before.length, b = text.length;
      while (a > start && b > start && before[a - 1] === text[b - 1]) { a--; b--; }
      const combined = { from: start, removed: before.slice(start, a), inserted: text.slice(start, b), before: previous.before, after: { ...selection } };
      if (this.changeBytes(combined) <= this.historyByteLimit) { this.past.pop(); this.bytes -= this.changeBytes(previous); change = combined; }
    }
    this.bytes -= this.future.reduce((size, item) => size + this.changeBytes(item), 0); this.future = [];
    this.past.push(change); this.bytes += this.changeBytes(change);
    this.trimHistory();
    this.group = group; this.groupTime = now;
    this.text = text; this.setSelection(selection); this.revision++;
    return true;
  }
  undo(): boolean {
    const change = this.past.pop(); if (!change) return false;
    this.text = this.applyChange(this.text, change, true);
    this.selection = { ...change.before }; this.future.push(change); this.revision++; this.boundary(); return true;
  }
  redo(): boolean {
    const change = this.future.pop(); if (!change) return false;
    this.text = this.applyChange(this.text, change, false);
    this.selection = { ...change.after }; this.past.push(change); this.revision++; this.boundary(); return true;
  }
  replace(ranges: SourceReplacement[], maxBytes = SOURCE_DOCUMENT_MAX_BYTES): boolean {
    const sorted = [...ranges].sort((a, b) => a.from - b.from);
    if (sourceReplacementLimit(this.text, sorted, this.historyByteLimit, maxBytes)) return false;
    const batch = sorted.map(range => ({ from: range.from, removed: this.text.slice(range.from, range.to), inserted: range.replacement })).filter(edit => edit.removed !== edit.inserted);
    if (!batch.length) return false;
    const first = sorted[0];
    const change: SourceChange = { from: 0, removed: '', inserted: '', batch, before: { ...this.selection }, after: { from: first.from, to: first.from + first.replacement.length, direction: 'forward' } };
    // Sparse ranges belong to one entry. Distant matches must not copy all the
    // untouched Markdown between them into the undo budget.
    const historyBytes = this.changeBytes(change);
    if (historyBytes > this.historyByteLimit) return false;
    this.text = this.applyChange(this.text, change, false); this.selection = { ...change.after };
    this.bytes -= this.future.reduce((size, item) => size + this.changeBytes(item), 0);
    this.past.push(change); this.future = []; this.bytes += historyBytes; this.trimHistory();
    this.revision++; this.boundary(); return true;
  }
  /** Rewrite resource locations in every history branch without adding an edit. */
  rewrite(transform: (text: string) => string, mapOffsets?: (text: string, offsets: number[]) => number[]): void {
    const offsets = (text: string, values: number[]) => mapOffsets ? mapOffsets(text, values) : values.map(offset => transform(text.slice(0, offset)).length);
    const selection = (text: string, value: SourceSelection): SourceSelection => { const [from, to] = offsets(text, [value.from, value.to]); return { ...value, from, to }; };
    const rewritten = (before: string, after: string, change: SourceChange): SourceChange => {
      const transformedBefore = transform(before), transformedAfter = transform(after);
      const edits = change.batch || [change], beforePoints = [0], afterPoints = [0];
      let delta = 0;
      for (let index = 0; index < edits.length; index++) {
        delta += edits[index].inserted.length - edits[index].removed.length;
        const boundary = index + 1 < edits.length ? Math.floor((edits[index].from + edits[index].removed.length + edits[index + 1].from) / 2) : before.length;
        beforePoints.push(boundary); afterPoints.push(boundary + delta);
      }
      // A tiny URL edit may turn into a larger resource rewrite. Partition at
      // unchanged gaps and derive actual transformed changes within each part;
      // mapping only the original edited characters can miss that larger URL.
      const mappedBefore = offsets(before, beforePoints), mappedAfter = offsets(after, afterPoints);
      const batch: SourceEdit[] = [];
      for (let index = 0; index < edits.length; index++) {
        const previous = transformedBefore.slice(mappedBefore[index], mappedBefore[index + 1]), next = transformedAfter.slice(mappedAfter[index], mappedAfter[index + 1]);
        let from = 0, a = previous.length, b = next.length;
        while (from < a && from < b && previous[from] === next[from]) from++;
        while (a > from && b > from && previous[a - 1] === next[b - 1]) { a--; b--; }
        if (a !== from || b !== from) batch.push({ from: mappedBefore[index] + from, removed: previous.slice(from, a), inserted: next.slice(from, b) });
      }
      return { from: 0, removed: '', inserted: '', batch, before: selection(before, change.before), after: selection(after, change.after) };
    };
    const rewrittenPast: SourceChange[] = [], rewrittenFuture: SourceChange[] = [];
    let after = this.text, transformedAfter = transform(after);
    for (let index = this.past.length - 1; index >= 0; index--) {
      const change = this.past[index];
      const before = this.applyChange(after, change, true);
      const transformedBefore = transform(before);
      if (transformedBefore !== transformedAfter) rewrittenPast.unshift(rewritten(before, after, change));
      after = before; transformedAfter = transformedBefore;
    }
    let before = this.text, transformedBefore = transform(before);
    for (let index = this.future.length - 1; index >= 0; index--) {
      const change = this.future[index];
      const after = this.applyChange(before, change, false);
      const transformedAfter = transform(after);
      if (transformedBefore !== transformedAfter) rewrittenFuture.unshift(rewritten(before, after, change));
      before = after; transformedBefore = transformedAfter;
    }
    this.selection = selection(this.text, this.selection);
    this.text = transform(this.text); this.renderedText = transform(this.renderedText);
    this.past = rewrittenPast; this.future = rewrittenFuture;
    this.bytes = [...this.past, ...this.future].reduce((size, change) => size + this.changeBytes(change), 0);
    this.trimHistory();
    this.boundary(); this.revision++;
  }
  lineStarts(): number[] {
    if (this.indexedText !== this.text) {
      this.starts = [0];
      for (let index = this.text.indexOf('\n'); index >= 0; index = this.text.indexOf('\n', index + 1)) this.starts.push(index + 1);
      this.indexedText = this.text;
    }
    return this.starts;
  }
  lineAt(offset: number): number {
    const starts = this.lineStarts(); let low = 0, high = starts.length;
    while (low + 1 < high) { const mid = (low + high) >> 1; if (starts[mid] <= offset) low = mid; else high = mid; }
    return low;
  }
  private changeBytes(change: SourceChange) { return (change.batch || [change]).reduce((size, edit) => size + (edit.removed.length + edit.inserted.length) * 2 + 48, 48); }
  private trimHistory(): void {
    while (this.past.length + this.future.length > this.historyLimit || this.bytes > this.historyByteLimit) {
      // Keep a contiguous recent undo branch and the nearest redo branch.
      // An individually oversized branch is released without changing text.
      const removed = this.past.length ? this.past.shift() : this.future.shift();
      if (!removed) break;
      this.bytes -= this.changeBytes(removed);
    }
  }
  private applyChange(text: string, change: SourceChange, undo: boolean): string {
    let delta = 0;
    const edits = (change.batch || [change]).map(edit => {
      const from = edit.from + (undo ? delta : 0); delta += edit.inserted.length - edit.removed.length;
      return { from, removed: undo ? edit.inserted : edit.removed, inserted: undo ? edit.removed : edit.inserted };
    });
    const pieces: string[] = []; let cursor = 0;
    for (const edit of edits) { pieces.push(text.slice(cursor, edit.from), edit.inserted); cursor = edit.from + edit.removed.length; }
    pieces.push(text.slice(cursor)); return pieces.join('');
  }
}

export const SOURCE_PREVIEW_CHARACTER_LIMIT = 64 * 1024;
export interface SourcePreviewWindow { content: string; from: number; to: number; firstLine: number; lastLine: number; totalLines: number; limited: boolean; }
/** Render a bounded nearby window instead of reparsing a huge file per input. */
export function sourcePreviewWindow(document: Pick<SourceDocument, 'text' | 'lineStarts' | 'lineAt'>, offset = 0, limit = SOURCE_PREVIEW_CHARACTER_LIMIT): SourcePreviewWindow {
  const text = document.text, starts = document.lineStarts();
  const line = document.lineAt(offset);
  let from = text.length <= limit ? 0 : Math.max(0, offset - Math.floor(limit / 3));
  if (from) { const newline = text.indexOf('\n', from); if (newline >= 0 && newline < offset) from = newline + 1; }
  let to = Math.min(text.length, from + limit);
  if (to < text.length) { const newline = text.lastIndexOf('\n', to); if (newline > from) to = newline + 1; }
  // An indivisible long line still has a strictly bounded preview.
  if (to <= from) { from = Math.max(0, Math.min(text.length - limit, starts[line])); to = Math.min(text.length, from + limit); }
  return { content: text.slice(from, to), from, to, firstLine: document.lineAt(from), lastLine: document.lineAt(Math.max(from, to - 1)), totalLines: starts.length, limited: from > 0 || to < text.length };
}

/** Sanitize before attaching untrusted Markdown HTML to the live app document. */
export function sanitizeSourcePreview(body: HTMLElement): void {
  body.querySelectorAll('script,iframe,object,embed,style,link,base,meta,form,button,textarea,select,svg,foreignObject').forEach(node => node.remove());
  body.querySelectorAll('*').forEach(element => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase(), value = attribute.value.replace(/[\s\u0000-\u001f]/g, '');
      if (name.startsWith('on') || ['style', 'srcdoc', 'srcset', 'formaction', 'autofocus', 'contenteditable', 'id', 'name'].includes(name)
        || (['src', 'href', 'xlink:href'].includes(name) && (/^(?:javascript|vbscript):/i.test(value) || /^data:/i.test(value) && !(element.tagName === 'IMG' && /^data:image\/(?:png|jpeg|gif|webp);/i.test(value))))) element.removeAttribute(attribute.name);
    }
    if (element instanceof HTMLInputElement) { element.disabled = true; element.tabIndex = -1; }
  });
}
