
import { mergeAttributes, Node } from '@tiptap/core';
import { getCellsInColumn, isRowSelected, isTableSelected, selectTable } from './utils/table';

import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import TableCellPopover from './wrapper/TableCellPopover.vue';
import {render,h} from 'vue';

export interface TableCellOptions {
  HTMLAttributes: Record<string, any>;
}

export const TableCell = Node.create<TableCellOptions, { clearCallbacks: Array<() => void> }>({
  name: 'tableCell',
  content: 'block+',
  tableRole: 'cell',
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => {
          const colspan = element.getAttribute('colspan');
          const value = colspan ? parseInt(colspan, 10) : 1;
          return value;
        },
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => {
          const rowspan = element.getAttribute('rowspan');
          const value = rowspan ? parseInt(rowspan, 10) : 1;
          return value;
        },
      },
      colwidth: {
        default: null,
        parseHTML: (element) => {
          const colwidth = element.getAttribute('colwidth');
          const value = colwidth ? [parseInt(colwidth, 10)] : null;
          return value;
        },
      },
      style: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'td' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addStorage() {
    return {
      clearCallbacks: [],
    };
  },

  onDestroy() {
    this.storage.clearCallbacks.forEach((cb) => cb());
    this.storage.clearCallbacks.length = 0;
  },

  // @ts-ignore
  addProseMirrorPlugins() {
    const { isEditable } = this.editor;

    return [
      new Plugin({
        key: new PluginKey('table-cell-control'),
        props: {
          decorations: (state) => {
            if (!isEditable) {
              return DecorationSet.empty;
            }
            const { doc, selection } = state;
            const decorations: Decoration[] = [];
            const cells = getCellsInColumn(0)(selection);
            
            if (cells) {
              this.storage.clearCallbacks.forEach((cb) => cb());
              this.storage.clearCallbacks.length = 0;

              cells.forEach(({ pos }, index) => {
                if (index === 0) {
                  decorations.push(
                    Decoration.widget(pos + 1, () => {
                      let className = 'grip-table';
                      const selected = isTableSelected(selection);
                      if (selected) {
                        className += ' selected';
                      }
                      const grip = document.createElement('a');
                      grip.className = className;
                      grip.addEventListener('mousedown', (event) => {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        this.editor.view.dispatch(
                          // @ts-ignore
                          selectTable(this.editor.state.tr)
                        );
                      });
                      return grip;
                    })
                  );
                }
                decorations.push(
                  Decoration.widget(pos + 1, () => {
                    const rowSelected = isRowSelected(index)(selection);
                    let className = 'grip-row';
                    if (rowSelected) {
                      className += ' selected';
                    }
                    if (index === 0) {
                      className += ' first';
                    }
                    if (index === cells.length - 1) {
                      className += ' last';
                    }

                    const container=document.createElement('div');
                    // @ts-ignore
                    render(h(TableCellPopover,{editor:this.editor,rowSelected,className,index}),container);

                    // const grip = document.createElement('a');

                    // const tooltip=document.createElement('div');
                    // tooltip.className='table-cell-tooltip';
                    // const pre=document.createElement('button');
                    // const del=document.createElement('button');
                    // const next=document.createElement('button');
                    // tooltip.appendChild(pre);
                    // tooltip.appendChild(del);
                    // tooltip.appendChild(next);
                    // pre.innerHTML='<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    // next.innerHTML='<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    // del.innerHTML='<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10V44H39V10H9Z" fill="none" stroke="#00c4ff" stroke-width="4" stroke-linejoin="round"/><path d="M20 20V33" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 20V33" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10H44" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10L19.289 4H28.7771L32 10H16Z" fill="none" stroke="#00c4ff" stroke-width="4" stroke-linejoin="round"/></svg>';
                    // pre.title='向前插入一行';
                    // del.title='删除行';
                    // next.title='向后插入一行';

                    


                    // const install=tippy(grip,{
                    //   content:tooltip,
                    //   allowHTML:true,
                    //   interactive:true,
                    //   appendTo:document.body,
                    //   arrow:false,
                    //   placement:'left',
                    //   theme:'light',
                    //   trigger:'mouseenter click',
                    //   offset:[0,0],
                    // });

                    // pre.onclick=()=>{
                    //   addRowBefore(this.editor.state, this.editor.view.dispatch);
                    // };
                    // del.onclick=()=>{
                    //   // console.log(e,'click',this.editor.state);
                    //   this.editor.commands.deleteRow();
                    // };
                    // next.onclick=()=>{
                    //   // console.log(e,'click',this.editor.state);
                    //   addRowAfter(this.editor.state, this.editor.view.dispatch);
                    // };

                    const grip=container.children[0];

                    // this.storage.clearCallbacks.push(() => {
                    //   // install.destroy();
                    //   grip.parentElement?.removeChild(grip);
                    // });

                    // grip.className = className;

                    // grip.addEventListener(
                    //   'mousedown',
                    //   (event) => {
                    //     event.preventDefault();
                    //     event.stopImmediatePropagation();

                    //     if(rowSelected){
                    //       this.editor.commands.blur();
                    //     }else{
                    //       this.editor.view.dispatch(
                    //         // @ts-ignore
                    //         selectRow(index)(this.editor.state.tr)
                    //       );
                    //     }
                        

                    //     if (event.target !== grip) {
                    //       addRowAfter(this.editor.state, this.editor.view.dispatch);
                    //     }
                    //   },
                    //   true
                    // );
                    
                    
                    return grip;
                  })
                );
              });
            }
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});