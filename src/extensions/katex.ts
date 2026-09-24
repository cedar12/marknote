
import { mergeAttributes, Node, textblockTypeInputRule } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import KatexWrapper from './wrapper/KatexWrapper.vue';
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

export const Katex = Node.create<IKatexOptions>({
  name: 'katex',
  group: 'block',
  selectable: true,
  content: 'text*',
  marks: '',
  code: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'katex-display',
      },
    };
  },

  addAttributes() {
    return {
      defaultShowPicker: {
        default: false,
      },
      createUser: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{
      tag: 'span.katex-display',
      contentElement: (element) => (element as HTMLElement).querySelector<HTMLElement>('annotation[encoding="application/x-tex"]') || element as HTMLElement,
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes((this.options && this.options.HTMLAttributes) || {}, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setKatex:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: options?.text ? [{ type: 'text', text: options.text }] : [],
          });
      },
      // toggleKatex: (attributes) => ({ commands }) => {
      //   return commands.toggleNode(this.name, 'paragraph', attributes)
      // },
    };
  },

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^\${2}\s*$/,
        type: this.type,
      }),
    ];
  },

  addNodeView() {
    return VueNodeViewRenderer(KatexWrapper);
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { selection } = this.editor.state;
        if (selection.$from.parent.type !== this.type) return false;
        this.editor.view.dispatch(this.editor.state.tr.insertText('\t'));
        return true;
      },
      Backspace: () => {
        const { selection } = this.editor.state;
        if (!selection.empty || selection.$from.parent.type !== this.type) return false;
        if (selection.$from.parentOffset === 0 && !selection.$from.parent.textContent) {
          return this.editor.commands.clearNodes();
        }
        return false;
      },
      Enter: () => {
        const { selection } = this.editor.state;
        const { $from, empty } = selection;
        if (!empty || $from.parent.type !== this.type) return false;
        if ($from.parentOffset !== $from.parent.content.size || !$from.parent.textContent.endsWith('\n\n')) return false;
        return this.editor.chain().command(({ tr }) => {
          tr.delete($from.pos - 2, $from.pos);
          return true;
        }).exitCode().run();
      },
    };
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

            const reg=/^\${2}\s*?\n(.+)\n\${2}/igs;
            

            const matches=reg.exec(text);
            if(!matches){
              return false;
            }
            // create an empty
            // const ntr=tr.replaceSelectionWith(this.type.create({ text:matches[1] }))
            const node = schema.nodes.katex.create(null, schema.text(matches[1]));
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
