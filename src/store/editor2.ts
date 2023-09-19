import {ShallowRef, shallowRef} from 'vue';
import { defineStore } from 'pinia';
import {Editor} from '@tiptap/vue-3';

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
        editor:shallowRef(),
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