

import { addCol } from './utils/table';

import { mergeAttributes, Node } from '@tiptap/core';
import { getCellsInRow, isColumnSelected, selectColumn } from './utils/table';

// import { Tooltip } from 'components/tooltip';
import { Plugin, PluginKey } from 'prosemirror-state';
import { addColumnAfter } from 'prosemirror-tables';
import { Decoration, DecorationSet } from 'prosemirror-view';
import tippy from 'tippy.js';

export interface TableHeaderOptions {
  HTMLAttributes: Record<string, any>;
}

export const TableHeader = Node.create<TableHeaderOptions, { clearCallbacks: Array<() => void> }>({
  name: 'tableHeader',
  content: 'block+',
  tableRole: 'header_cell',
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
      },
      rowspan: {
        default: 1,
      },
      colwidth: {
        default: [100],
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
    return [{ tag: 'th' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
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
        key: new PluginKey('table-header-control'),
        props: {
          decorations: (state) => {
            if (!isEditable) {
              return DecorationSet.empty;
            }
            const { doc, selection } = state;
            const decorations: Decoration[] = [];
            const cells = getCellsInRow(0)(selection);
            if (cells) {
              this.storage.clearCallbacks.forEach((cb) => cb());
              this.storage.clearCallbacks.length = 0;

              cells.forEach(({ pos }, index) => {
                decorations.push(
                  Decoration.widget(pos + 1, () => {
                    const colSelected = isColumnSelected(index)(selection);
                    let className = 'grip-column';
                    if (colSelected) {
                      className += ' selected';
                    }
                    if (index === 0) {
                      className += ' first';
                    } else if (index === cells.length - 1) {
                      className += ' last';
                    }
                    const grip = document.createElement('a');
                    grip.className = className;

                    const tooltip=document.createElement('div');
                    tooltip.className='table-row-tooltip';
                    const pre=document.createElement('button');
                    const del=document.createElement('button');
                    const next=document.createElement('button');
                    tooltip.appendChild(pre);
                    tooltip.appendChild(del);
                    tooltip.appendChild(next);
                    pre.innerHTML='<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    next.innerHTML='<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24.0605 10L24.0239 38" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 24L38 24" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
                    del.innerHTML='<svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 10V44H39V10H9Z" fill="none" stroke="#00c4ff" stroke-width="4" stroke-linejoin="round"/><path d="M20 20V33" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 20V33" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10H44" stroke="#00c4ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10L19.289 4H28.7771L32 10H16Z" fill="none" stroke="#00c4ff" stroke-width="4" stroke-linejoin="round"/></svg>';
                    pre.title='向前插入一列';
                    del.title='删除行';
                    next.title='向后插入一列';

                    


                    const install=tippy(grip,{
                      content:tooltip,
                      allowHTML:true,
                      interactive:true,
                      appendTo:document.body,
                      arrow:false,
                      placement:'top',
                      theme:'light',
                      trigger:'click',
                    });

                    pre.onclick=(e)=>{
                      this.editor.commands.addColumnBefore();
                    };
                    del.onclick=(e)=>{
                      this.editor.commands.deleteColumn();
                    };
                    next.onclick=(e)=>{
                      addColumnAfter(this.editor.state, this.editor.view.dispatch);
                    };

                    

                    this.storage.clearCallbacks.push(() => {
                      install.destroy();
                    });

                    this.storage.clearCallbacks.push(() => {
                      // ReactDOM.unmountComponentAtNode(grip);
                    });

                    grip.addEventListener('mousedown', (event) => {
                      event.preventDefault();
                      event.stopImmediatePropagation();

                      this.editor.view.dispatch(selectColumn(index)(this.editor.state.tr));

                      if (event.target !== grip) {
                        addColumnAfter(this.editor.state, this.editor.view.dispatch);
                      }
                    });
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