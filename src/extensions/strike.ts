import { markInputRule, markPasteRule } from '@tiptap/core';
import { Strike as BaseStrike } from '@tiptap/extension-strike';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { findMarkPosition } from './utils/mark';

export const inputRegex = /(?:^|\s)((?:~~)((?:[^~]+))(?:~~))$/
export const pasteRegex = /(?:^|\s)((?:~~)((?:[^~]+))(?:~~))/g

export const Strike = BaseStrike.extend({
  addInputRules() {
    return [
      markInputRule({
        find: inputRegex,
        type: this.type,
      }),
    ]
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: pasteRegex,
        type: this.type,
      }),
    ]
  },

  // @ts-ignore
  addProseMirrorPlugins() {
    const { isEditable } = this.editor;
    return [
      new Plugin({
        key: new PluginKey('strike-wrapper'),
        props: {
          decorations: (state) => {
            if (!isEditable) {
              return DecorationSet.empty;
            }
            const { doc, selection } = state;
            const marks = selection.$head.marks();
            const decorations: Decoration[] = [];
            marks.forEach(mark => {
              if (mark.type.name === this.name) {
                const { start, end } = findMarkPosition(state, mark, selection.from, selection.to);
                decorations.push(Decoration.widget(start, () => {
                  const span = document.createElement('span');
                  span.className = 'strike-wrapper strike-start';
                  span.innerText = '~~';
                  return span;
                }, { side: -1 }));
                decorations.push(Decoration.widget(end, () => {
                  const span = document.createElement('span');
                  span.className = 'strike-wrapper strike-end';
                  span.innerText = '~~';
                  return span;
                }, { side: 1 }));
              }

            })
            return DecorationSet.create(doc, decorations);
          },
        },
      }),

    ];
  },

});
