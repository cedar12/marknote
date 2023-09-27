import { mergeAttributes,Node } from '@tiptap/core';
import { textblockTypeInputRule } from '@tiptap/vue-3';

export const Html = Node.create({
    name:'html',
    priority:10,

    // @ts-ignore
    addOptions() {

        return {
          tag: null,
          HTMLAttributes:{

          },
        }
      },
    
      content: 'inline*',
    
      group: 'block',
    
      defining: true,
    
      addAttributes() {
        return {
          tag:{
            default: null,
            rendered:true,
            parseHTML: element => {
              console.log('parse',element);
              return element.nodeName;
            }
          }
        }
      },
    
      parseHTML() {
        return [{tag:this.options.tag}]
      },
    
      renderHTML({ node, HTMLAttributes }) {
        console.log('render',node);
        return [node.attrs.tag, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
      },
    
      addCommands() {
        return {
          
        }
      },
    
      addKeyboardShortcuts() {
        return {}
      },
    
      addInputRules() {
        return [
          textblockTypeInputRule({
            find: /\<(\w+)(\s+((.+?)="(.+)?")+\s*?)?\>/,
            type: this.type,
            getAttributes: (match)=>{
              var attr={
                tag:match[1],
                HTMLAttributes:{},
              }
              if(match[3]){
                var htmlAttr:{[key:string]:string}={};
                const matchs=match[3].split(' ');
                matchs.forEach(m=>{
                  const domAttr=m.trim().split('=');
                  htmlAttr[domAttr[0].trim()]=domAttr[1].trim().substring(1,domAttr[1].trim().length-1);
                });
                attr.HTMLAttributes=htmlAttr;
              }
              console.log('rule',attr);
              return attr;
            },
          })
        ]
      },


});