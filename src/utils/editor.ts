import { useEditor } from '@tiptap/vue-3';
import { wrappingInputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import { Strike } from '../extensions/strike';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '../extensions/markdown';
import { Table } from '../extensions/table';
import { TableHeader } from '../extensions/tableHeader';
import { TableCell } from '../extensions/tableCell';
import { TableRow } from '../extensions/tableRow';
import { lowlight } from './lowlight';
import { CodeBlock } from '../extensions/codeBlock2';
import { Heading } from '../extensions/heading';
import { Link } from '../extensions/link';
import { Italic } from '../extensions/italic';
import { Bold } from '../extensions/bold';
import { Code } from '../extensions/code';
import { Focus } from '../extensions/focus';
import { Image } from '../extensions/image';
import { Katex } from '../extensions/katex';
import CharacterCount from '@tiptap/extension-character-count'
import { useAppStore } from '../store/app';
import { useEditorStore } from '../store/editor';
import hotkeys from 'hotkeys-js';

const MarknoteTable = Table.extend({
  addInputRules() {
    let inputRule = wrappingInputRule({
      find: /^\|{3}\s/,
      type: this.type,
    });
    return [
      inputRule,
    ]
  },
});

Markdown.configure({
  html: true,                  // Allow HTML input/output
  tightLists: true,            // No <p> inside <li> in markdown output
  tightListClass: 'tight',     // Add class to <ul> allowing you to remove <p> margins when tight
  bulletListMarker: '*',       // <li> prefix in markdown output
  linkify: false,              // Create links from "https://..." text
  breaks: true,               // New lines (\n) in markdown input are converted to <br>
  transformPastedText: false,  // Allow to paste markdown text in the editor
  transformCopiedText: false,  // Copied text is transformed to markdown
})



function createEditor() {



  const editor = useEditor({
    content: '',
    editorProps: {
      attributes: {
        class: 'marknote'
      },

      handleDrop: (view, e) => {
        console.log('drop', view, e);
      },
      handleKeyDown(_view, event) {
        const keys = [];
        const appStore = useAppStore();
        if (event.metaKey) {
          keys.push(appStore.platform === 'darwin' ? 'command' : 'win');
        } else if (event.ctrlKey) {
          keys.push('ctrl');
        }
        if (event.key === 'Process' && event.ctrlKey) {
          hotkeys.trigger('ctrl+.', 'file');
        } else {
          keys.push(event.key);
          const key = keys.join('+').toLocaleLowerCase();
          // console.log('handleKeyDown',view,event,key);
          hotkeys.trigger(key, 'file');
        }

      },
      handleDOMEvents: {
        drop: (view, e) => {
          e.preventDefault();
          console.log('drop', view, e);
        },
      },
    },
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false
      }),
      Heading,
      Strike,
      Bold,
      Italic,
      Code.configure({
        HTMLAttributes:{
          class: 'inline'
        }
      }),
      Focus,
      CharacterCount,
      Image.configure({
        inline: false,
      }),
      Katex,
      TaskItem,
      TaskList.configure({
        HTMLAttributes: {
          class: 'marknote-tasklist'
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      MarknoteTable.configure({
        HTMLAttributes: {
          class: 'marknote-table'
        },

      }),
      CodeBlock.configure({

        lowlight,
      }),
      Markdown,
    ],
    onTransaction(_props) {
      // const {view,state}=props.editor;
      // const selection=state.selection;
      // const node=getNode(state);
      // const node=view.nodeDOM(selection.$anchor.pos);
      // const dom=view.nodeDOM(selection.$anchor.pos);
      // console.log('tr',props,node,dom);

      const editorStore = useEditorStore();
      editorStore.getTree();
    },
    onUpdate: () => {
      // const editorStore = useEditorStore();
      const appStore = useAppStore();
      appStore.isSave = false;
      // editorStore.tree = getTree();
      const editorStore = useEditorStore();
      editorStore.getTree();
    },
    onCreate: () => {
      // const editorStore = useEditorStore();
      // editorStore.tree = getTree();
      // console.log(editorStore.tree)
      const editorStore = useEditorStore();
      editorStore.getTree();
    },

  });
  window.editor = editor;
  return editor;
}





export { createEditor };