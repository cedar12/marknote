import { Extension, type Range } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { type Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setSearchIndex: (index: number) => ReturnType;
      /** Replace the selected/current search result. */
      replace: () => ReturnType;
      replaceAll: () => ReturnType;
    };
  }
}

export const searchAndReplacePluginKey = new PluginKey('searchAndReplacePlugin');

export interface SearchAndReplaceOptions {
  searchResultClass: string;
  caseSensitive: boolean;
  disableRegex: boolean;
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: Range[];
  lastSearchTerm: string;
  index: number;
}

function findResults(doc: PMNode, term: RegExp): Range[] {
  const textRuns: { text: string; pos: number }[] = [];
  let current: { text: string; pos: number } | undefined;
  doc.descendants((node, pos) => {
    if (!node.isText) {
      current = undefined;
      return;
    }
    if (current && current.pos + current.text.length === pos) current.text += node.text;
    else {
      current = { text: node.text || '', pos };
      textRuns.push(current);
    }
  });
  const results: Range[] = [];
  for (const { text, pos } of textRuns) {
    for (const match of text.matchAll(term)) {
      if (!match[0].length || match.index === undefined) continue;
      results.push({ from: pos + match.index, to: pos + match.index + match[0].length });
    }
  }
  return results;
}

function searchExpression(term: string, options: SearchAndReplaceOptions): RegExp {
  const expression = options.disableRegex ? term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : term;
  return new RegExp(expression, options.caseSensitive ? 'gu' : 'gui');
}

function updateResults(doc: PMNode, storage: SearchAndReplaceStorage, options: SearchAndReplaceOptions, transaction?: Transaction): DecorationSet {
  const changedTerm = storage.lastSearchTerm !== storage.searchTerm;
  storage.lastSearchTerm = storage.searchTerm;
  if (!storage.searchTerm) {
    storage.results = [];
    storage.index = 0;
    return DecorationSet.empty;
  }
  storage.results = findResults(doc, searchExpression(storage.searchTerm, options));
  if (changedTerm) storage.index = 0;
  const nextFrom = transaction?.getMeta(searchAndReplacePluginKey)?.nextFrom;
  if (typeof nextFrom === 'number') {
    const next = storage.results.findIndex(result => result.from >= nextFrom);
    storage.index = next < 0 ? 0 : next;
  }
  storage.index = Math.max(0, Math.min(storage.index, storage.results.length - 1));
  return DecorationSet.create(doc, storage.results.map((result, index) => Decoration.inline(result.from, result.to, {
    class: options.searchResultClass + (index === storage.index ? ' current-result' : ''),
  })));
}

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions, SearchAndReplaceStorage>({
  name: 'searchAndReplace',

  addOptions() {
    return { searchResultClass: 'search-result', caseSensitive: false, disableRegex: true };
  },

  addStorage() {
    return { searchTerm: '', replaceTerm: '', results: [], lastSearchTerm: '', index: 0 };
  },

  addCommands() {
    const options = this.options;
    return {
      setSearchTerm: searchTerm => ({ editor, tr, dispatch }) => {
        if (dispatch) {
          editor.storage.searchAndReplace.searchTerm = searchTerm;
          tr.setMeta(searchAndReplacePluginKey, { refresh: true });
        }
        return true;
      },
      setReplaceTerm: replaceTerm => ({ editor, dispatch }) => {
        if (dispatch) editor.storage.searchAndReplace.replaceTerm = replaceTerm;
        return true;
      },
      setSearchIndex: index => ({ editor, tr, dispatch }) => {
        if (dispatch) {
          editor.storage.searchAndReplace.index = index;
          tr.setMeta(searchAndReplacePluginKey, { refresh: true });
        }
        return true;
      },
      replace: () => ({ editor, tr, dispatch }) => {
        if (editor.isEditable === false) return false;
        const storage: SearchAndReplaceStorage = editor.storage.searchAndReplace;
        if (!storage.searchTerm) return false;
        // Read the transaction document so a chained search/edit cannot reuse
        // result positions from the previous query or document.
        const results = findResults(tr.doc, searchExpression(storage.searchTerm, options));
        const selected = results.find(result => result.from === tr.selection.from && result.to === tr.selection.to);
        const currentIndex = storage.searchTerm === storage.lastSearchTerm ? storage.index : 0;
        const result = selected || results[Math.min(currentIndex, results.length - 1)];
        if (!result) return false;
        if (dispatch) {
          tr.insertText(storage.replaceTerm, result.from, result.to);
          tr.setMeta(searchAndReplacePluginKey, { nextFrom: result.from + storage.replaceTerm.length });
        }
        return true;
      },
      replaceAll: () => ({ editor, tr, dispatch }) => {
        if (editor.isEditable === false) return false;
        const storage: SearchAndReplaceStorage = editor.storage.searchAndReplace;
        if (!storage.searchTerm) return false;
        const results = findResults(tr.doc, searchExpression(storage.searchTerm, options));
        if (!results.length) return false;
        if (dispatch) {
          // Replacing backwards preserves every earlier result's position.
          for (const result of results.reverse()) tr.insertText(storage.replaceTerm, result.from, result.to);
          tr.setMeta(searchAndReplacePluginKey, { nextFrom: 0 });
        }
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    return [new Plugin({
      key: searchAndReplacePluginKey,
      state: {
        // Opening a different segment also clears positions from the previous document.
        init: (_, state) => {
          editor.storage.searchAndReplace.index = 0;
          return updateResults(state.doc, editor.storage.searchAndReplace, options);
        },
        apply: (transaction, oldState) => {
          const storage: SearchAndReplaceStorage = editor.storage.searchAndReplace;
          if (!transaction.docChanged && !transaction.getMeta(searchAndReplacePluginKey) && storage.lastSearchTerm === storage.searchTerm) return oldState;
          return updateResults(transaction.doc, storage, options, transaction);
        },
      },
      props: {
        decorations(state) { return this.getState(state); },
      },
    })];
  },
});
