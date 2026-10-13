import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

export interface ChangedDocumentRange {
  oldFrom: number;
  oldTo: number;
  from: number;
  to: number;
}

/** Resolve each step's changed range into the initial and final documents. */
export function changedDocumentRanges(transaction: Transaction): ChangedDocumentRange[] {
  const ranges: ChangedDocumentRange[] = [];
  transaction.mapping.maps.forEach((map, index) => {
    const before = transaction.mapping.slice(0, index).invert();
    const after = transaction.mapping.slice(index + 1);
    let mapped = false;
    const add = (oldFrom: number, oldTo: number, from: number, to: number) => {
      mapped = true;
      ranges.push({ oldFrom: before.map(oldFrom, -1), oldTo: before.map(oldTo, 1), from: after.map(from, -1), to: after.map(to, 1) });
    };
    map.forEach(add);
    if (!mapped) {
      // Mark steps have an empty position map but can change heading text or
      // node attributes. Their explicit range still identifies the blocks.
      const step = transaction.steps[index] as unknown as { from?: number; to?: number; pos?: number };
      const from = step.from ?? step.pos;
      const to = step.to ?? step.pos;
      if (from !== undefined && to !== undefined) add(from, to, from, to);
    }
  });
  if (transaction.docChanged && !ranges.length) ranges.push({ oldFrom: 0, oldTo: transaction.before.content.size, from: 0, to: transaction.doc.content.size });
  return ranges;
}

export function changedBlockNodes(doc: ProseMirrorNode, ranges: { from: number; to: number }[], typeName: string): { node: ProseMirrorNode; pos: number }[] {
  const blocks = new Map<number, ProseMirrorNode>();
  for (const range of ranges) {
    const from = Math.max(0, Math.min(doc.content.size, range.from - 1));
    const to = Math.max(from, Math.min(doc.content.size, range.to + 1));
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === typeName) {
        blocks.set(pos, node);
        return false;
      }
      // An unrelated textblock cannot contain the requested block type.
      if (node.isTextblock) return false;
    });
  }
  return [...blocks].sort(([first], [second]) => first - second).map(([pos, node]) => ({ node, pos }));
}
