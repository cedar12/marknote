
import { Editor, JSONContent } from '@tiptap/vue-3';
import { defineStore } from 'pinia';


export const useEditorStore = defineStore('editor', {
  state():{
    tree:NodeTree[],
    codeTheme:string,
    loading:boolean,
    headings:JSONContent[],
  }{
      return {
        tree:[],
        codeTheme:localStorage.getItem('codeTheme')||'default',
        loading:false,
        headings:[],
      }
  },

  getters:{
    editor():Editor{
      return window.editor?.value;
    }
  },
  
  actions:{
    setContent(content:string){
      this.editor?.commands.clearContent(false);
      this.editor?.commands.setContent(content,false);
    },
  }

});




export interface NodeTree{
  label:string,
  value:string,
  children:NodeTree[],
}