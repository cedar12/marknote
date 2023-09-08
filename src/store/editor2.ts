import { defineStore } from 'pinia';
import {useEditor} from '@tiptap/vue-3';
import { wrappingInputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import {Table} from '../node/table';
import {TableHeader} from '../node/tableHeader';
import {TableCell} from '../node/tableCell';
import {TableRow} from '../node/tableRow';
import { lowlight } from '../utils/lowlight';
import {CodeBlock} from '../node/codeBlock2';

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
export const useEditorStore = defineStore('editor2', {
  state() {
      return {
        editor:useEditor({
          content: '',
          editorProps:{
            attributes:{
              class:'marknote'
            }
          },
          extensions:[
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
            // MarknoteCodeBlock.configure({
            CodeBlock.configure({
        
              lowlight,
            }),
            Markdown,
          ]
        })
      }
  },

});