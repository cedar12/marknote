import { VueNodeViewRenderer } from '@tiptap/vue-3';
import { CodeBlock as BaseCodeBlock, type CodeBlockOptions } from '@tiptap/extension-code-block';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { lowlight, AUTO_HIGHLIGHT_LANGUAGES } from '../utils/lowlight';
import { changedBlockNodes, changedDocumentRanges } from '../utils/editorTransactions';
import CodeBlockWrapper from './wrapper/CodeBlockWrapper.vue';

export const MAX_AUTO_HIGHLIGHT_SIZE = 12 * 1024;
export const MAX_HIGHLIGHT_SIZE = 256 * 1024;

function parseNodes(nodes: any[], className: string[] = []): { text: string; classes: string[] }[] {
  return nodes.flatMap(node => {
    const classes = [...className, ...(node.properties?.className || [])];
    return node.children ? parseNodes(node.children, classes) : [{ text: node.value, classes }];
  });
}

interface HighlightRange { from: number; to: number; classes: string; }

export function LowlightPlugin({ name, lowlight, defaultLanguage }: {
  name: string;
  lowlight: any;
  defaultLanguage: string | null | undefined;
}) {
  if (!['highlight', 'highlightAuto', 'listLanguages'].every(api => typeof lowlight[api] === 'function')) {
    throw Error('A lowlight instance is required for code highlighting');
  }
  // PM nodes are immutable and unchanged blocks retain their node identity.
  // Weak keys release token arrays along with evicted documents/history.
  const highlights = new WeakMap<ProseMirrorNode, HighlightRange[]>();
  const languages: string[] = lowlight.listLanguages();
  const autoSubset = AUTO_HIGHLIGHT_LANGUAGES.filter(language => languages.includes(language));

  const highlightBlock = (node: ProseMirrorNode): HighlightRange[] => {
    const cached = highlights.get(node);
    if (cached) return cached;
    const text = node.textContent;
    const language = node.attrs.language || defaultLanguage;
    const known = language && (typeof lowlight.registered === 'function' ? lowlight.registered(language) : languages.includes(language));
    let ranges: HighlightRange[] = [];
    if (text.length <= MAX_HIGHLIGHT_SIZE && (known || text.length <= MAX_AUTO_HIGHLIGHT_SIZE)) {
      try {
        const result = known ? lowlight.highlight(language, text) : lowlight.highlightAuto(text, { subset: autoSubset });
        let from = 0;
        ranges = parseNodes(result.value || result.children || []).flatMap(token => {
          const to = from + token.text.length;
          const range = token.classes.length ? [{ from, to, classes: token.classes.join(' ') }] : [];
          from = to;
          return range;
        });
      } catch {
        // Unsupported/malformed grammars must not block document editing.
      }
    }
    highlights.set(node, ranges);
    return ranges;
  };

  const decorationsForBlock = ({ node, pos }: { node: ProseMirrorNode; pos: number }): Decoration[] =>
    highlightBlock(node).map(range => Decoration.inline(pos + 1 + range.from, pos + 1 + range.to, { class: range.classes }, { codeBlockNode: node }));

  const plugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
    key: new PluginKey('marknoteLowlight'),
    state: {
      init: (_, { doc }) => {
        const decorations: Decoration[] = [];
        doc.descendants((node, pos) => {
          if (node.type.name !== name) return;
          for (const decoration of decorationsForBlock({ node, pos })) decorations.push(decoration);
          return false;
        });
        return DecorationSet.create(doc, decorations);
      },
      apply: (transaction, oldDecorations) => {
        if (!transaction.docChanged) return oldDecorations;
        let mapped = oldDecorations.map(transaction.mapping, transaction.doc);
        const ranges = changedDocumentRanges(transaction);
        const previous = changedBlockNodes(transaction.before, ranges.map(range => ({ from: range.oldFrom, to: range.oldTo })), name);
        for (const block of previous) {
          const from = transaction.mapping.map(block.pos + 1, -1);
          const to = transaction.mapping.map(block.pos + block.node.nodeSize - 1, 1);
          mapped = mapped.remove(mapped.find(from, Math.max(from, to)).filter(decoration => decoration.spec.codeBlockNode === block.node));
        }
        const changed = changedBlockNodes(transaction.doc, ranges, name);
        return mapped.add(transaction.doc, changed.flatMap(decorationsForBlock));
      },
    },
    props: { decorations(state) { return plugin.getState(state); } },
  });
  return plugin;
}

export interface CodeBlockLowlightOptions extends CodeBlockOptions {
  lowlight: any;
  defaultLanguage: string | null | undefined;
}

export const CodeBlock = BaseCodeBlock.extend<CodeBlockLowlightOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      lowlight: {},
      defaultLanguage: null,
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(CodeBlockWrapper)
  },

  addProseMirrorPlugins() {
    return [
      // configure()/extend() can add several copies of this field to the
      // inheritance chain. Call the base paste handler directly so there is
      // exactly one syntax plugin, regardless of the number of extensions.
      ...(BaseCodeBlock.config.addProseMirrorPlugins?.call(this) || []),
      LowlightPlugin({
        name: this.name,
        lowlight: this.options.lowlight,
        defaultLanguage: this.options.defaultLanguage,
      }),
    ];
  },
  // @ts-ignore
  addKeyboardShortcuts(){
    
    return {
      'Tab': () => {
        if(this.editor.isActive('codeBlock')){
          this.editor.view.dispatch(this.editor.state.tr.insertText('\t'));
          return true;
        }
        // return this.editor.commands.indent();
        return false;
      },
      'Shift-Tab': () => {
        if(this.editor.isActive('codeBlock')){
          // this.editor.view.dispatch(this.editor.state.tr.insertText('\t'));
          return true;
        }
        // return this.editor.commands.indent();
        return false;
      },
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock(),

      // remove code block when at start of document or code block is empty
      Backspace: () => {
        const { empty, $anchor } = this.editor.state.selection
        const isAtStart = $anchor.pos === 1

        if (!empty || $anchor.parent.type.name !== this.name) {
          return false
        }

        if (isAtStart || !$anchor.parent.textContent.length) {
          return this.editor.commands.clearNodes()
        }

        return false
      },

      // exit node on triple enter
      Enter: ({ editor }) => {
        if (!this.options.exitOnTripleEnter) {
          return false
        }

        const { state } = editor
        const { selection } = state
        const { $from, empty } = selection

        if (!empty || $from.parent.type !== this.type) {
          return false
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2
        const endsWithDoubleNewline = $from.parent.textContent.endsWith('\n\n')

        if (!isAtEnd || !endsWithDoubleNewline) {
          return false
        }

        return editor
          .chain()
          .command(({ tr }) => {
            tr.delete($from.pos - 2, $from.pos)

            return true
          })
          .exitCode()
          .run()
      },

      // exit node on arrow down
      ArrowDown: ({ editor }) => {
        if (!this.options.exitOnArrowDown) {
          return false
        }

        const { state } = editor
        const { selection, doc } = state
        const { $from, empty } = selection

        if (!empty || $from.parent.type !== this.type) {
          return false
        }

        const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2

        if (!isAtEnd) {
          return false
        }

        const after = $from.after()

        if (after === undefined) {
          return false
        }

        const nodeAfter = doc.nodeAt(after)

        if (nodeAfter) {
          return false
        }

        return editor.commands.exitCode()
      },
    };
  }
}).configure({
  lowlight,
  defaultLanguage: 'auto',
});
