import { markInputRule } from '@tiptap/core';
import { Link as BuiltInLink } from '@tiptap/extension-link';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const extractHrefFromMatch = (match:RegExpExecArray) => {
  return { href: match.groups?.href };
};

export const extractHrefFromMarkdownLink = (match:RegExpExecArray) => {
  /**
   * Removes the last capture group from the match to satisfy
   * tiptap markInputRule expectation of having the content as
   * the last capture group in the match.
   *
   * https://github.com/ueberdosis/tiptap/blob/%40tiptap/core%402.0.0-beta.75/packages/core/src/inputRules/markInputRule.ts#L11
   */
  match.pop();
  return extractHrefFromMatch(match);
};

export const Link = BuiltInLink.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
    };
  },

  addInputRules() {
    const markdownLinkSyntaxInputRuleRegExp = /(?:^|\s)\[([\w|\s|-|\u4e00-\u9fa5]+)\]\((?<href>.+?)\)$/gm;
    const urlSyntaxRegExp = /(?:^|\s)(?<href>(?:https?:\/\/|www\.)[\S]+)(?:\s|\n)$/gim;

    return [
      markInputRule({
        find: markdownLinkSyntaxInputRuleRegExp,
        type: this.type,
        getAttributes: extractHrefFromMarkdownLink,
      }),
      markInputRule({
        find: urlSyntaxRegExp,
        type: this.type,
        getAttributes: extractHrefFromMatch,
      }),
    ];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('href'),
      },
      title: {
        title: null,
        parseHTML: (element) => element.getAttribute('title'),
      },
    };
  },


  // @ts-ignore
  addProseMirrorPlugins() {
    const { isEditable } = this.editor;

    return [
      new Plugin({
        key: new PluginKey('link-control'),
        props: {
          decorations: (state) => {
            if (!isEditable) {
              return DecorationSet.empty;
            }
            const { doc, selection } = state;
            const decorations: Decoration[] = [Decoration.inline(selection.from,selection.to,{},()=>{
              const container=document.createElement('a');
              container.className='link-wrapper';
              container.innerHTML='aaaaaaa';
              return container;
            })];
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
      new Plugin({
        key: new PluginKey('linkHandler'),
        props: {
            handleClick: (view,pos, event) => {
              event.preventDefault();
              console.log(view,pos);
            }
        }
      }),
    ];
  },


}).configure({
  openOnClick: false,
  linkOnPaste: true,
  autolink: false,
});