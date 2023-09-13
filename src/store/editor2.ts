import {ShallowRef} from 'vue';
import { defineStore } from 'pinia';
import {Editor, useEditor} from '@tiptap/vue-3';
import { wrappingInputRule } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import {Strike} from '../node/strike';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import {Table} from '../node/table';
import {TableHeader} from '../node/tableHeader';
import {TableCell} from '../node/tableCell';
import {TableRow} from '../node/tableRow';
import { lowlight } from '../utils/lowlight';
import {CodeBlock} from '../node/codeBlock2';
import {Heading} from '../node/heading';
import {Link} from '../node/link';
import {Focus} from '../node/focus';
import {Image} from '@tiptap/extension-image';
import Dropcursor from '@tiptap/extension-dropcursor';
import CharacterCount from '@tiptap/extension-character-count'

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
  state():{
    tree:NodeTree[],
    editor:ShallowRef<Editor | undefined>,
    codeTheme:string,
    loading:boolean,
  }{
      return {
        tree:[],
        codeTheme:'github',
        loading:false,
        editor:useEditor({
          content: '',
          editorProps:{
            attributes:{
              class:'marknote'
            }
          },
          extensions:[
            StarterKit,
            Link,
            Heading,
            Strike,
            Focus,
            CharacterCount,
            Image.configure({
              inline:true
            }),
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
            Dropcursor,
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
            
            const editorStore=useEditorStore();
            editorStore.tree=editorStore.getTree();
          },
          onUpdate:()=>{
            console.log('更新outliner data');
            const editorStore=useEditorStore();
            editorStore.tree=editorStore.getTree();
          },
          onCreate:()=>{
            console.log('初始化outliner data');
            const editorStore=useEditorStore();
            editorStore.tree=editorStore.getTree();
            console.log(editorStore.tree)
          }
        })
      }
  },
  
  actions:{
    setContent(content:string){
      this.editor?.commands.setContent(content);
      this.tree=this.getTree();
    },
    getTree(){
      const json=this.editor?.getJSON();
      // console.log(json);
      const tree:NodeTree[]=[];
      for (let i = 0; json?.content && i < json?.content?.length; i++) {
        const node = json?.content[i];
        if(node.type=='heading'){
          let text='';
          if(node.content&&node.content.length>0){
            text=node.content[0].text||'';
          }
          const item={label:text,value:node.attrs?.id,children:[]};
          if(node.attrs?.level===1){
            tree.push(item);
          }else if(node.attrs?.level===2){
            if(tree.length===0){
              tree.push({label:'#',value:'',children:[]});
            }
            tree[tree.length-1].children.push(item);
          }else if(node.attrs?.level===3){
            if(tree.length===0){
              tree.push({label:'#',value:'',children:[]});
            }
            if(tree[tree.length-1].children.length===0){
              tree[tree.length-1].children=[{label:'##',value:'',children:[]}];
            }
            const parent=tree[tree.length-1]
            parent.children[parent.children.length-1].children.push(item);
          }else if(node.attrs?.level===4){
            if(tree.length===0){
              tree.push({label:'#',value:'',children:[]});
            }
            const parent1=tree[tree.length-1]
            if(parent1.children.length===0){
              tree[tree.length-1].children=[{label:'##',value:'',children:[]}];
            }
            
            const parent2=parent1.children[parent1.children.length-1];
            if(parent2.children.length===0){
              tree[tree.length-1].children[parent1.children.length-1].children=[{label:'###',value:'',children:[]}];
            }
            
            const parent3=parent2.children[parent2.children.length-1];
            parent3.children[parent3.children.length-1].children.push(item);
          }
          
        }
      }
      return tree;
    }
  }

});


export interface NodeTree{
  label:string,
  value:string,
  children:NodeTree[],
}