import { markInputRule, markPasteRule } from '@tiptap/core';
import {Strike as BaseStrike} from '@tiptap/extension-strike';


export const inputRegex = /(?:^|\s)((?:~~)((?:[^~]+))(?:~~))$/
export const pasteRegex = /(?:^|\s)((?:~~)((?:[^~]+))(?:~~))/g

export const Strike=BaseStrike.extend({
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
});
