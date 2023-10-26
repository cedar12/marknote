
import { mergeAttributes, Node, nodeInputRule,nodePasteRule } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import KatexWrapper from './wrapper/InlineKatexWrapper.vue';
import { Plugin, PluginKey } from '@tiptap/pm/state'

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

export const InlineKatex = Node.create<IKatexOptions>({
  name: 'inlineKatex',
  group: 'inline',
  selectable: true,
  atom: true,
  draggable: true,
  inline:true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'inline-katex',
      },
    };
  },

  addAttributes() {
    return {
      text: {
        default: '',
        parseHTML: (el)=>{
          console.log(el);
          // if(el.getAttribute('text')){
          //   return el.getAttribute('text');
          // }
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
    return [{ tag: 'span.katex' }];
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
        find: /(\$\s*?(.+)\s*?\$)/,
        type: this.type,
        getAttributes: (match) => {
          console.log('input inline katex',match);
          return { text:match[2] };
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\$(.+)\$/g,
        type: this.type,
        getAttributes: (match, pasteEvent) => {
          // const html = pasteEvent?.clipboardData?.getData('text/html')
          // const hrefRegex = /$$\s*\n(.*)"/

          // const existingLink = html?.match(hrefRegex)

          // if (existingLink) {
          //   return {
          //     text: existingLink[1],
          //   }
          // }
          console.log('katex',match,pasteEvent);
          return {
            text: ''//match.data?.text,
          }
        },
      }),
    ]
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
  },
  // @ts-ignore
  addProseMirrorPlugins() {
    return [
      
      new Plugin({
        key: new PluginKey('katexVSCodeHandler'),
        props: {
          handlePaste: (view, event) => {
            if (!event.clipboardData) {
              return false
            }

            if (this.editor.isActive(this.type.name)) {
              return false
            }

            const text = event.clipboardData.getData('text/plain')

            if (!text) {
              return false
            }

            const { tr,schema } = view.state

            const reg=/^\$\s*?(.+)\s*?\$/g;
            

            const matches=reg.exec(text);
            if(!matches){
              return false;
            }
            // create an empty
            // const ntr=tr.replaceSelectionWith(this.type.create({ text:matches[1] }))
            const node = schema.nodes.inlineKatex.create({
              text: matches[1],
            });
            const transaction = tr.replaceSelectionWith(node);
            transaction.setMeta('paste', true)
            view.dispatch(transaction)
            

            return true
          },
        },
      }),
    ]
  },

});