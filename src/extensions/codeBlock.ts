import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { EditorView } from "@tiptap/pm/view";
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { getNodeAtPos, isInCodeBlock } from "./utils/node";
import { writeText } from "@tauri-apps/api/clipboard";

const options=[
  {
    label:'javascript',
    value:'javascript'
  },
  {
    label:'typescript',
    value:'typescript'
  },
  {
    label:'html',
    value:'xml'
  },
  {
    label:'xml',
    value:'xml'
  },
  {
    label:'c',
    value:'c'
  },
  {
    label:'cpp',
    value:'cpp'
  },
  {
    label:'css',
    value:'css'
  },
  {
    label:'java',
    value:'java'
  },
  {
    label:'rust',
    value:'rust'
  },
  {
    label:'go',
    value:'go'
  },
  {
    label:'shell',
    value:'shell'
  },
  {
    label:'dos',
    value:'dos'
  },
  {
    label:'ini',
    value:'ini'
  },
];

export const CodeBlock=CodeBlockLowlight.extend({
  
  // @ts-ignore
  addProseMirrorPlugins() {
    const { isEditable } = this.editor;

    return [
      ...this.parent?.() || [],
      new Plugin({
        key: new PluginKey('codeblock-copy-control'),
        props: {
          decorations: (state) => {
            if (!isEditable) {
              return DecorationSet.empty;
            }
            const { doc, selection } = state;
            if(!isInCodeBlock(state)){
              return DecorationSet.empty;
            }
            const decorations: Decoration[] = [
              Decoration.widget(selection.anchor,(view: EditorView, getPos: () => number | undefined):Node=>{
                const pos=getPos();
                
                // @ts-ignore
                const dom=view.domAtPos(pos).node;
                // @ts-ignore
                const node=getNodeAtPos(state,pos);
                const div=document.createElement('div');
                div.className='codeblock-tool';
                div.style.height='0';

                const select=document.createElement('select');
                // console.log(dom,node);
                console.log('attr',node.attrs);
                select.value=(node.attrs.language||this.options.defaultLanguage)||'';
                for(let i=0;i<options.length;i++){
                  const option=document.createElement('option');
                  if(options[i].value===select.value){
                    option.selected=true;
                  }
                  option.innerText=options[i].label;
                  option.value=options[i].value;
                  select.appendChild(option);
                }

                const copy=document.createElement('span');
                copy.className='codeblock-copy';
                copy.innerHTML='<svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z" fill="none" stroke-width="4" stroke-linejoin="round"/></svg>';
                
                div.appendChild(select);
                div.appendChild(copy);

                select.addEventListener('change',()=>{
                  console.log('change',select.value,this.options);
                  
                  // state.tr.setNodeAttribute(pos,'')
                  //@ts-ignore
                  const node=getNodeAtPos(state,pos);
                  //@ts-ignore
                  
                  //@ts-ignore
                  const p=this.editor.state.doc.resolve(pos);

                  console.log(node,pos,p);
                  //@ts-ignore
                  this.editor.view.dispatch(state.tr.setNodeAttribute(p.path[2],'language',select.value));
                  this.options.defaultLanguage=select.value;
                });

                copy.addEventListener('click', () => {
                  if(!pos){
                    return;
                  }
                  const node=getNodeAtPos(state,pos);
                  //@ts-ignore
                  const text=node.content.content[0].text;
                  writeText(text);
                  // console.log(text);
                  // const range = document.createRange();
                  
                  // range.selectNodeContents(node);
                  // const selection = window.getSelection();
                  // selection?.removeAllRanges();
                  // selection?.addRange(range);
                  // document.execCommand('copy');
                });
                return div;
              }),
            ];
            
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});