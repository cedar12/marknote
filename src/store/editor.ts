
import { Editor } from '@tiptap/vue-3';
import { defineStore } from 'pinia';


export const useEditorStore = defineStore('editor', {
  state():{
    tree:NodeTree[],
    codeTheme:string,
    loading:boolean,
  }{
      return {
        tree:[],
        codeTheme:'github',
        loading:false,
        
      }
  },

  getters:{
    editor():Editor{
      return window.editor.value;
    }
  },
  
  actions:{
    setContent(content:string){
      window.editor.value?.commands.setContent(content);
      this.tree=this.getTree();
    },
    getTree(){
      const json=window.editor.value?.getJSON();
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