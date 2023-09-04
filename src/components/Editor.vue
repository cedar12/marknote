<!-- <script setup lang="ts">
import { ref ,onMounted} from "vue";
import {MarknoteEditorView} from "./EditorView";

const editor = ref();


onMounted(()=>{
  const marknoteView=new MarknoteEditorView(editor.value);
  console.log(marknoteView);
})
</script>

<template>
  <div class="editor" ref="editor"></div>
</template>

<style lang="scss">
.editor>div{
  outline: none;
  padding: 1.2em;
}
</style> -->
<template>
  <div>
    <BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShowTable">
      <button @click="editor.chain().focus().addColumnAfter().run()">增加列</button>
      <button @click="editor.chain().focus().deleteColumn().run()">删除列</button>
      <button @click="editor.chain().focus().addRowAfter().run()">增加行</button>
      <button @click="editor.chain().focus().deleteRow().run()">删除行</button>
      <button @click="editor.chain().focus().mergeOrSplit().run()">合并单元格</button>
      <button @click="editor.chain().focus().toggleHeaderRow().run()">表头</button>
    </BubbleMenu>
    <BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShowText">
      <button @click="editor.chain().focus().toggleBold().run()">加粗</button>
      <button @click="editor.chain().focus().toggleItalic().run()">斜体</button>
      <button @click="editor.chain().focus().toggleStrike().run()">删除线</button>
      <button @click="editor.chain().focus().toggleCode().run()">代码</button>
    </BubbleMenu>
    <editor-content :editor="editor" ></editor-content>
  </div>
  
</template>

<script setup lang="ts">
import {onMounted} from 'vue'
import { useEditor, EditorContent ,BubbleMenu } from '@tiptap/vue-3'
import {  wrappingInputRule,mergeAttributes } from '@tiptap/core'
import Text from '@tiptap/extension-text'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import css from 'highlight.js/lib/languages/css'
import js from 'highlight.js/lib/languages/javascript'
import ts from 'highlight.js/lib/languages/typescript'
import html from 'highlight.js/lib/languages/xml'
// load all highlight.js languages
import { lowlight } from 'lowlight'

import 'highlight.js/scss/github.scss'

lowlight.registerLanguage('html', html)
lowlight.registerLanguage('css', css)
lowlight.registerLanguage('js', js)
lowlight.registerLanguage('ts', ts)

import { invoke } from "@tauri-apps/api/tauri";

const shouldShowTable= (props:any) => {
    return props.editor.isActive('table')
}
const shouldShowText= (props:any) => {
    return props.editor.isActive('bold')||props.editor.isActive('ltalic')||props.editor.isActive('text')||props.editor.isActive('inline')
}


const MarknoteTable=Table.extend({
  addInputRules() {
    let inputRule = wrappingInputRule({
      find: /^\|{3}\s/,
      type: this.type,
    });
    return [
      inputRule,
    ]
  },
});


const MarknoteTaskItem=TaskItem.extend({
  parseHTML() {
    return [
      {
        tag: `[data-type="${this.name}"]`,//`input[type="checkbox"]`,//
        priority: 51,
        contentElement(dom:HTMLElement){
          console.log('conent',dom);
          // const children=dom.children;//querySelector('input[type="checkbox"]');
          // if(children.length>0&&children[0].nodeName==='INPUT'&&children[0].getAttribute('type')==='checkbox'){
          //   return MarknoteTaskItem;
          // }
          return dom;
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      }),
      [
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
          },
          0
        ],
      ],
    ]
  },

  addNodeView() {
    return ({
      node, HTMLAttributes, getPos, editor,
    }) => {
      console.log('node view',node);
      const listItem = document.createElement('li')
      // const checkboxWrapper = document.createElement('label')
      // const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createTextNode('');

      // checkboxWrapper.contentEditable = 'false'
      checkbox.contentEditable = 'false'
      checkbox.type = 'checkbox'
      checkbox.addEventListener('change', event => {
        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked

          return
        }

        const { checked } = event.target as any

        if (editor.isEditable && typeof getPos === 'function') {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const position = getPos()
              const currentNode = tr.doc.nodeAt(position)

              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked,
              })

              return true
            })
            .run()
        }
        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          // Reset state if onReadOnlyChecked returns false
          if (!this.options.onReadOnlyChecked(node, checked)) {
            checkbox.checked = !checkbox.checked
          }
        }
      })

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      listItem.dataset.checked = node.attrs.checked
      if (node.attrs.checked) {
        checkbox.setAttribute('checked', 'checked')
      }

      // checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkbox, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      return {
        dom: listItem,
        contentDOM: content,
        update: updatedNode => {
          if (updatedNode.type !== this.type) {
            return false
          }

          listItem.dataset.checked = updatedNode.attrs.checked
          if (updatedNode.attrs.checked) {
            checkbox.setAttribute('checked', 'checked')
          } else {
            checkbox.removeAttribute('checked')
          }

          return true
        },
      }
    }
  },
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\s*(\[([( |x])?\])\s$/,
        type: this.type,
        getAttributes: match => {
          console.log('task item',match);
          return {
          checked: match[match.length - 1].trim() === 'x',
        }},
      }),
    ]
  },
});

const MarknoteTableCell = TableCell.extend({
  addAttributes() {
    return {
      // extend the existing attributes …
      ...this.parent?.(),

      // and add a new one …
      backgroundColor: {
        default: null,
        parseHTML: (element:any) => element.getAttribute('data-background-color'),
        renderHTML: (attributes:any) => {
          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          }
        },
      },
    }
  },
})

var editor = useEditor({
  content: '',//'<p>在 Vue.js中运行 Tiptap  🎉</p>',
  editorProps:{
    attributes:{
      class:'marknote'
    }
  },
  extensions: [
    StarterKit,
    Text,
    TaskItem,
    TaskList.configure({
      HTMLAttributes:{
        class: 'marknote-task'
      },
      
    }),
    TableRow,
    TableHeader,
    MarknoteTableCell,
    MarknoteTable.configure({
      HTMLAttributes:{
        class: 'marknote-table'
      },
      
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
  ],
});

onMounted(async ()=>{
  const value:string = await invoke("to_html", { md: '在 Vue.js中运行 Tiptap  🎉\n# marknote\n2. 1\n* [x] a\n* [x] b\n```javascript\nconsole.log(123);' });
  console.log(value);
  const parser=new DOMParser();
  const doc=parser.parseFromString(value,'text/html');
  console.log(doc);
  const taskItems=doc.querySelectorAll('ul>li>input[type="checkbox"]');
  for (let i = 0; i < taskItems.length; i++) {
    const taskItem = taskItems[i];
    console.log(taskItem);
    taskItem.removeAttribute('disabled');
    
    const li=taskItem.parentElement;
    li?.parentElement?.setAttribute('data-type','taskList');
    
    li?.setAttribute('data-checked',taskItem.getAttribute('checked')||'false');
    //<li data-checked="true"><label contenteditable="false"><input type="checkbox" checked="checked"><span></span></label><div><p><br class="ProseMirror-trailingBreak"></p></div></li>
    const label=document.createElement('label');
    label.contentEditable='false';
    const span=document.createElement('span');
    
    const content=document.createElement('div');
    li?.appendChild(label);

    li?.childNodes.forEach(node=>{
      if(node.nodeType===3){
        content.appendChild(node);
      }
    })
    
    label.appendChild(taskItem);
    label.appendChild(span);
    // li?.removeChild(taskItem);
    li?.appendChild(content);
  }
  const content=doc.body.innerHTML;
  // console.log(content);
  editor.value?.commands.setContent(content)
});


</script>

<style lang="scss">
.marknote{
  outline: none;
  margin: 1rem 0;

  > * + * {
    margin-top: 0.75em;
  }

  ul,
  ol {
    padding: 0 1rem;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    line-height: 1.1;
  }

  code {
    background-color: rgba(#616161, 0.1);
    color: #616161;
  }

  pre {
    background: #0D0D0D;
    color: #FFF;
    font-family: 'JetBrainsMono', monospace;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;

    code {
      color: inherit;
      padding: 0;
      background: none;
      font-size: 0.8rem;
    }
  }

  img {
    max-width: 100%;
    height: auto;
  }

  blockquote {
    padding-left: 1rem;
    border-left: 2px solid rgba(#0D0D0D, 0.1);
  }

  hr {
    border: none;
    border-top: 2px solid rgba(#0D0D0D, 0.1);
    margin: 2rem 0;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    overflow: hidden;

    td,
    th {
      min-width: 1em;
      border: 1px solid #ced4da;
      padding: 3px 5px;
      vertical-align: top;
      box-sizing: border-box;
      position: relative;

      > * {
        margin-bottom: 0;
      }
    }

    th {
      font-weight: bold;
      text-align: left;
      background-color: #f1f3f5;
    }

    .selectedCell:after {
      z-index: 2;
      position: absolute;
      content: "";
      left: 0; right: 0; top: 0; bottom: 0;
      background: rgba(200, 200, 255, 0.4);
      pointer-events: none;
    }

    .column-resize-handle {
      position: absolute;
      right: -2px;
      top: 0;
      bottom: -2px;
      width: 4px;
      background-color: #adf;
      pointer-events: none;
    }

    p {
      margin: 0;
    }
  }
  
  ul[data-type="taskList"] {
    list-style: none;
    padding: 0;

    p {
      margin: 0;
    }

    li {
      display: flex;

      > label {
        flex: 0 0 auto;
        margin-right: 0.5rem;
        user-select: none;
      }

      > div {
        flex: 1 1 auto;
      }

      ul li,
      ol li {
        display: list-item;
      }

      ul[data-type="taskList"] > li {
        display: flex;
      }
    }
  }
}
</style>