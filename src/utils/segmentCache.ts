import type { EditorState } from '@tiptap/pm/state';

export const SEGMENT_CACHE_LIMIT = 8;
export const SEGMENT_CACHE_BYTE_LIMIT = 16 * 1024 * 1024;

interface HistoryItems {
  forEach(callback: (item: { step?: { slice?: { content: { size: number } } } }) => void): void;
}

function estimatedStateBytes(state: EditorState): number {
  let size = state.doc.nodeSize * 2;
  for (const plugin of state.plugins) {
    const history = plugin.getState(state) as { done?: { items?: HistoryItems }; undone?: { items?: HistoryItems } } | null;
    if (!history?.done?.items || !history.undone?.items) continue;
    for (const branch of [history.done, history.undone]) branch.items?.forEach(item => { size += (item.step?.slice?.content.size || 0) * 2 + 64; });
  }
  return size;
}

export class SegmentEditorCache {
  private states = new Map<number, { state: EditorState; bytes: number }>();
  private bytes = 0;

  constructor(readonly limit = SEGMENT_CACHE_LIMIT, readonly byteLimit = SEGMENT_CACHE_BYTE_LIMIT) {}

  peek(index: number): EditorState | undefined { return this.states.get(index)?.state; }

  delete(index: number): void {
    const old = this.states.get(index);
    if (old) this.bytes -= old.bytes;
    this.states.delete(index);
  }

  put(index: number, state: EditorState): void {
    this.delete(index);
    const bytes = estimatedStateBytes(state);
    if (bytes > this.byteLimit) return;
    this.states.set(index, { state, bytes });
    this.bytes += bytes;
    while (this.states.size > this.limit || this.bytes > this.byteLimit) this.delete(this.states.keys().next().value!);
  }

  clear(): void { this.states.clear(); this.bytes = 0; }

  snapshot(): { indexes: number[]; bytes: number; limit: number; byteLimit: number } {
    return { indexes: [...this.states.keys()], bytes: this.bytes, limit: this.limit, byteLimit: this.byteLimit };
  }
}
