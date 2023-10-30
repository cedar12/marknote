import { Italic as BuiltInItalic } from '@tiptap/extension-italic';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { findMarkPosition } from './utils/mark';

export const Italic=BuiltInItalic.extend({
  // @ts-ignore
  addProseMirrorPlugins() {
    const { isEditable } = this.editor;
    return [
      new Plugin({
        key: new PluginKey('italic-wrapper'),
        props: {
          decorations: (state) => {
            if (!isEditable) {
              return DecorationSet.empty;
            }
            const { doc, selection } = state;
            const marks=selection.$head.marks();
            const decorations: Decoration[] = []
            marks.forEach(mark=>{
              if(mark.type.name===this.name){
                const {start,end}=findMarkPosition(state,mark,selection.from,selection.to);
                decorations.push(Decoration.widget(start,()=>{
                  const span=document.createElement('span');
                  span.className='italic-wrapper italic-start';
                  span.innerText='*';
                  return span;
                },{side:0}));
                decorations.push(Decoration.widget(end,()=>{
                  const span=document.createElement('span');
                  span.className='italic-wrapper italic-end';
                  span.innerText='*';
                  return span;
                },{side:1}));
              }
              
            })
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
      
    ];
  },
});