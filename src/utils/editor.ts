import { useEditor } from '@tiptap/vue-3';
import { wrappingInputRule } from '@tiptap/core';
// import StarterKit from '@tiptap/starter-kit';
import Document from '@tiptap/extension-document';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import HardBreak from '@tiptap/extension-hard-break';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import Italic from '@tiptap/extension-italic';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import History from '@tiptap/extension-history';
import TaskList from '@tiptap/extension-task-list';
import { Strike } from '../node/strike';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { Table } from '../node/table';
import { TableHeader } from '../node/tableHeader';
import { TableCell } from '../node/tableCell';
import { TableRow } from '../node/tableRow';
import { lowlight } from './lowlight';
import { CodeBlock } from '../node/codeBlock2';
import { Heading } from '../node/heading';
import { Link } from '../node/link';
import { Focus } from '../node/focus';
import { Image } from '../node/image';
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



function createEditor(){



const editor = useEditor({
  content: '',
  editorProps:{
    attributes:{
      class:'marknote'
    },
    
    handleDrop:(view,e)=>{
      console.log('drop',view,e);
    },
    handleKeyDown(view, event) {
      const keys=[];
      const appStore=useAppStore();
      if(event.metaKey){
        keys.push(appStore.platform==='darwin'?'command':'win');
      }else if(event.ctrlKey){
        keys.push('ctrl');
      }
      if(event.key==='Process'&&event.ctrlKey){
        hotkeys.trigger('ctrl+.','file');
      }else{
        keys.push(event.key);
        const key=keys.join('+').toLocaleLowerCase();
        // console.log('handleKeyDown',view,event,key);
        hotkeys.trigger(key,'file');
      }
      
    },
    handleDOMEvents: {
      drop: (view, e) => { 
        e.preventDefault(); 
        console.log('drop',view,e);
      },
    },
  },
  extensions: [
    // StarterKit,
    Document,
    Text,
    Paragraph,
    HardBreak,
    HorizontalRule,
    Bold,
    Code,
    Italic,
    Dropcursor,
    Gapcursor,
    History,
    Link.configure({
      openOnClick:false
    }),
    Heading,
    Strike,
    Focus,
    CharacterCount,
    Image.configure({
      inline: true
    }),
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
    editorStore.tree = editorStore.getTree();
  },
  onUpdate: () => {
    // const editorStore = useEditorStore();
    const appStore = useAppStore();
    appStore.isSave = false;
    // editorStore.tree = getTree();
    const editorStore = useEditorStore();
    editorStore.tree = editorStore.getTree();
  },
  onCreate: () => {
    // const editorStore = useEditorStore();
    // editorStore.tree = getTree();
    // console.log(editorStore.tree)
    const editorStore = useEditorStore();
    editorStore.tree = editorStore.getTree();
  },

});
window.editor=editor;
return editor;
}





export { createEditor };