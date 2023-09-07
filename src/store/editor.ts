import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { wrappingInputRule,Editor,mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
// import Heading from '@tiptap/extension-heading'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
// import Table from '@tiptap/extension-table'
// import TableCell from '@tiptap/extension-table-cell'
// import TableHeader from '@tiptap/extension-table-header'
// import TableRow from '@tiptap/extension-table-row'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from 'tiptap-markdown';
// import BubbleTable from './bubble/BubbleTable.vue'

import {Table} from '../node/table';
import {TableHeader} from '../node/tableHeader';
import {TableCell} from '../node/tableCell';
import {TableRow} from '../node/tableRow';


// load all highlight.js languages
import { lowlight } from '../utils/lowlight'
import { Extensions } from '@tiptap/vue-3'



const MarknoteCodeBlock=CodeBlockLowlight.extend({
  addNodeView() {
    return () => {
      const container = document.createElement('pre')

      const content = document.createElement('code')
      container.append(content);

      const copy=document.createElement('span');
      copy.className='codeblock-copy';
      copy.innerHTML='<svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z" fill="none" stroke-width="4" stroke-linejoin="round"/></svg>';
      container.appendChild(copy);
      
      copy.addEventListener('click', () => {
        const range = document.createRange();
        range.selectNodeContents(content);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('copy');
      })

      return {
        dom: container,
        contentDOM: content,
      }
    }
  },
});

const MarknoteTable=Table.extend({
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

var editor:Editor|null=null;

export const useEditorStore = defineStore('editor', {
  state:():{
    content:string,
    contextmenuEvent:null|MouseEvent,
    // editor:Editor|null,
  }=>({
    content:'',
    contextmenuEvent:null,
    // editor:null,
  }),
  actions:{
    create(el:HTMLElement,exts:Extensions=[]){
      // const self=this;
      editor = new Editor({
        element:el,
        content: '',
        editorProps:{
          attributes:{
            class:'marknote'
          }
        },
        extensions: [
          StarterKit,
          TaskItem,
          TaskList.configure({
            HTMLAttributes:{
              class: 'marknote-task'
            },
            
          }),
          TableRow,
          TableHeader,
          TableCell,
          MarknoteTable.configure({
            HTMLAttributes:{
              class: 'marknote-table'
            },
            
          }),
          MarknoteCodeBlock.configure({
            lowlight,
          }),
          Markdown,
          ...exts,
        ],
        onCreate({editor}) {
          console.log(editor.view.dom)
            // editor.view.dom.addEventListener('contextmenu',(e)=>{
            //   console.log(e);
            //   e.stopPropagation();
            //   const editorStore=useEditorStore();
              
            //   editorStore.contextmenuEvent=e;
            // },true);
            editor.view.dom.oncontextmenu='' as any;
        },
        onUpdate({editor,transaction}) {
          const {state} = editor;
          // const sleection=state.selection;
          
          console.log(editor,state.tr.doc);
          const appStore=useAppStore();
          appStore.isSave=false;
        },
        onSelectionUpdate({editor,transaction}) {
          const {state} = editor;
          const selection=state.selection;
          console.log(editor,state.tr.doc.nodeAt(selection.anchor));
          console.log('onSelectionUpdate',editor,transaction);
        },
      });
      
    },

    ref(){
      return editor;
    },

    setContent(content:string){
      editor?.commands.setContent(content);
    },

    commands(){
      return editor?.commands
    },
    storage(){
      return editor?.storage;
    },
    chain(){
      const chain=editor?.chain();
      return chain;
    },

    getMarkdown(){
      return editor?.storage.markdown.getMarkdown();
    }
  }
})