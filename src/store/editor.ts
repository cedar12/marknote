
import { Editor, JSONContent } from '@tiptap/vue-3';
import { defineStore } from 'pinia';

export interface Heading{
  level: number,
  text: string,
  id: string,
  status:'open'|'close',
  show:boolean,
}

export const useEditorStore = defineStore('editor', {
  state():{
    codeTheme:string,
    loading:boolean,
    headings:Heading[],
  }{
      return {
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

    
    updateHeadings() {
      this.headings = [];

      const items:Heading[]=[];
      const transaction = this.editor.state.tr

      this.editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const id = `heading-${items.length + 1}`

          if (node.attrs.id !== id) {
            transaction.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              id,
            })
          }

          items.push({
            level: node.attrs.level,
            text: node.textContent,
            id,
            status:'open',
            show:true,
          })
        }
      })

      transaction.setMeta('addToHistory', false)
      transaction.setMeta('preventUpdate', true)

      this.editor.view.dispatch(transaction)

      this.headings=items;
      console.log('headings',this.headings);
    }
  }

});
