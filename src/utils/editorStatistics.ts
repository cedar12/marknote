import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface DocumentStatistics {
  characters: number;
  words: number;
}

function countWords(text: string): number {
  let count = 0;
  let inWord = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === ' ') inWord = false;
    else if (!inWord) {
      count += 1;
      inWord = true;
    }
  }
  return count;
}

/** Match CharacterCount's visible PM text semantics for both statistics scopes. */
export class EditorStatisticsCache {
  private blocks = new WeakMap<ProseMirrorNode, DocumentStatistics>();

  count(doc: ProseMirrorNode): DocumentStatistics {
    const total = { characters: 0, words: 0 };
    doc.forEach(node => {
      let statistics = this.blocks.get(node);
      if (!statistics) {
        const characters = node.isLeaf ? (node.isText ? node.text?.length || 0 : 1) : node.textBetween(0, node.content.size, undefined, ' ').length;
        const text = node.isLeaf ? (node.isText ? node.text || '' : ' ') : node.textBetween(0, node.content.size, ' ', ' ');
        statistics = { characters, words: countWords(text) };
        this.blocks.set(node, statistics);
      }
      total.characters += statistics.characters;
      total.words += statistics.words;
    });
    return total;
  }
}
