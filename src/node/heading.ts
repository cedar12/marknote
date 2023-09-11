import { mergeAttributes } from '@tiptap/core';
import { Heading as BaseHeading } from '@tiptap/extension-heading';
import { textblockTypeInputRule } from '@tiptap/vue-3';
import { Extension } from '@tiptap/core';

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { findNode, getNodeAtPos } from './utils/node';

export const Heading = BaseHeading.extend({
    // @ts-ignore
    addOptions() {

        return {
          levels: [1, 2, 3, 4, 5, 6],
          HTMLAttributes: {
            id:null,
          },
        }
      },
    
      content: 'inline*',
    
      group: 'block',
    
      defining: true,
    
      addAttributes() {
        return {
          level: {
            default: 1,
            rendered: false,
          },
          id:{
            default: null,
            rendered:true,
            parseHTML: element => {
                return element.innerText;
            }
          }
        }
      },
    
      parseHTML() {
        return this.options.levels
          .map((level: number) => ({
            tag: `h${level}`,
            attrs: { level },
          }))
      },
    
      renderHTML({ node, HTMLAttributes }) {
        const hasLevel = this.options.levels.includes(node.attrs.level)
        const level = hasLevel
          ? node.attrs.level
          : this.options.levels[0]
    
        return [`h${level}`, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
      },
    
      addCommands() {
        return {
          setHeading: attributes => ({ commands }) => {
            if (!this.options.levels.includes(attributes.level)) {
              return false
            }
    
            return commands.setNode(this.name, attributes)
          },
          toggleHeading: attributes => ({ commands }) => {
            if (!this.options.levels.includes(attributes.level)) {
              return false
            }
    
            return commands.toggleNode(this.name, 'paragraph', attributes)
          },
        }
      },
    
      addKeyboardShortcuts() {
        return this.options.levels.reduce((items, level) => ({
          ...items,
          ...{
            [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level }),
          },
        }), {})
      },
    
      addInputRules() {
        return this.options.levels.map(level => {
          return textblockTypeInputRule({
            find: new RegExp(`^(#{1,${level}})\\s$`),
            type: this.type,
            getAttributes: {
              level,
            },
          })
        })
      },
});