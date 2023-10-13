
import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import KatexWrapper from './wrapper/KatexWrapper.vue';

export type IKatexAttrs = {
  text?: string;
  defaultShowPicker?: boolean;
};

export interface IKatexOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    katex: {
      setKatex: (arg?: IKatexAttrs) => ReturnType;
    };
  }
}

export const Katex = Node.create<IKatexOptions>({
  name: 'katex',
  group: 'block',
  selectable: true,
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'katex',
      },
    };
  },

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (el)=>{
          const tex=el.querySelector('annotation[encoding="application/x-tex"]') as HTMLElement;
          // console.log(el,tex,tex.textContent);
          return tex.textContent;
        },
      },
      defaultShowPicker: {
        default: false,
      },
      createUser: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span.katex-display' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes((this.options && this.options.HTMLAttributes) || {}, HTMLAttributes)];
  },

  addCommands() {
    return {
      setKatex:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
      },
      // toggleKatex: (attributes) => ({ commands }) => {
      //   return commands.toggleNode(this.name, 'paragraph', attributes)
      // },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /^\${2}\s$/,
        type: this.type,
        getAttributes: () => {
          return { defaultShowPicker: true };
        },
      }),
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(KatexWrapper);
  },

  // @ts-ignore
  addKeyboardShortcuts(){
    
    return {
      'Mod-Alt-M': () => {
        console.log('toggle katex');
        // return this.editor.commands.toggleKatex()
      },
    }  
  }

});