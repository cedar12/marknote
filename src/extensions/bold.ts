import { Bold as BuiltInBold } from '@tiptap/extension-bold';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { findMarkPosition } from './utils/mark';

export const Bold=BuiltInBold.extend({
  // @ts-ignore
  addProseMirrorPlugins() {
    const { isEditable } = this.editor;
    return [
      new Plugin({
        key: new PluginKey('bold-wrapper'),
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
                  span.className='bold-wrapper bold-start';
                  span.innerText='**';
                  return span;
                },{side:-1}));
                decorations.push(Decoration.widget(end,()=>{
                  const span=document.createElement('span');
                  span.className='bold-wrapper bold-end';
                  span.innerText='**';
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