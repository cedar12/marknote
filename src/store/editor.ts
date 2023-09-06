import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { wrappingInputRule,Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Markdown } from 'tiptap-markdown';
// import BubbleTable from './bubble/BubbleTable.vue'

// load all highlight.js languages
import { lowlight } from '../utils/lowlight'

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
    // editor:Editor|null,
  }=>({
    content:'',
    // editor:null,
  }),
  actions:{
    create(el:HTMLElement){
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
          CodeBlockLowlight.configure({
            lowlight,
          }),
          Markdown,
        ],
        onUpdate(props) {
          console.log(props);
            const appStore=useAppStore();
            appStore.isSave=false;
        },
        onSelectionUpdate({editor,transaction}) {
          console.log('onSelectionUpdate',editor,transaction);
        },
      });
      
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
      return editor?.chain;
    },

    getMarkdown(){
      return editor?.storage.markdown.getMarkdown();
    }
  }
})