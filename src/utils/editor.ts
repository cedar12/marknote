import { useEditor } from '@tiptap/vue-3';
import { wrappingInputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import { Strike } from '../extensions/strike';
import TaskItem from '@tiptap/extension-task-item';
import {Placeholder} from '@tiptap/extension-placeholder';
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
import { InlineKatex } from '../extensions/inlineKatex';
import { Html } from '../extensions/html';
import { TableOfContents } from '../extensions/tableOfContents';
import CharacterCount from '@tiptap/extension-character-count';
import {SearchAndReplace} from "../extensions/searchAndReplace";
import { useAppStore } from '../store/app';
import { useEditorStore } from '../store/editor';
import { usePreferencesStore } from '../store/preferences';
import { watch } from 'vue';
import { applyMarkdownPreferencesToEditor } from './markdownPreferences';


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

function createEditor() {
  const preferencesStore = usePreferencesStore();
  const editor = useEditor({
    content: '',
    injectCSS:false,
    editorProps: {
      attributes: {
        class: 'marknote min-height',
      },

      handleDrop: (view, e) => {
        console.log('drop', view, e);
      },
      handleKeyDown(_view, _event) {
        /*
        const keys = [];
        const appStore = useAppStore();
        if (event.metaKey) {
          keys.push(appStore.platform === 'macos' ? 'command' : 'win');
        } else if (event.ctrlKey) {
          keys.push('ctrl');
        }
        if(event.altKey){
          keys.push('alt');
        }
        if(event.shiftKey){
          keys.push('shift');
        }
        if (event.key === 'Process' && event.ctrlKey) {
          hotkeys.trigger('ctrl+.', 'file');
        } else {
          keys.push(event.key);
          const key = keys.join('+').toLocaleLowerCase();
          console.log('handleKeyDown',event,key);
          hotkeys.trigger(key, 'file');
          hotkeys.trigger(key, 'view');
        }
        */
      },

    },
    extensions: [
      StarterKit,
      SearchAndReplace.configure(),
      Link.configure({
        openOnClick: false
      }),
      Heading,
      Strike,
      Html,
      Bold,
      Italic,
      Placeholder.configure({
        placeholder: '输入内容...',
      }),
      Code.configure({
        HTMLAttributes:{
          class: 'inline'
        }
      }),
      Focus,
      CharacterCount,
      Image.configure({
        inline: true,
      }),
      InlineKatex,
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
      TableOfContents,
      Markdown.configure({ ...preferencesStore.markdown, preserveExistingHtml: true }),
    ],
    onTransaction(_props) {
      // const {view,state}=props.editor;
      // const selection=state.selection;
      // const node=getNode(state);
      // const node=view.nodeDOM(selection.$anchor.pos);
      // const dom=view.nodeDOM(selection.$anchor.pos);
      // console.log('tr',props,node,dom);

    },
    onUpdate: () => {
      const editorStore = useEditorStore();
      const appStore = useAppStore();
      editorStore.markCurrentSegmentEdited();
      appStore.markEdited();
      // editorStore.tree = getTree();
    },
    onCreate: () => {
      // editorStore.tree = getTree();
      // console.log(editorStore.tree)
    },

  });
  watch([() => editor.value, () => preferencesStore.markdown], ([current]) => {
    applyMarkdownPreferencesToEditor(current, preferencesStore.markdown);
  }, { deep: true, flush: 'sync', immediate: true });
  return editor;
}





export { createEditor };
