import { keymap } from "prosemirror-keymap";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import {undo, redo} from "prosemirror-history";
import {baseKeymap} from "prosemirror-commands";
import { defaultMarkdownParser,
  defaultMarkdownSerializer} from "prosemirror-markdown"
import {Schema} from "prosemirror-model"
import {buildInputRules} from "./InputRules";
import {schema} from "./schema";


const mySchema = new Schema({
  nodes: schema.spec.nodes,
  marks: schema.spec.marks
})

export class MarknoteEditorView{
  view:EditorView;
  constructor(el:HTMLElement,content:string='# marknote'){
    this.view=new EditorView(el,{
      state: EditorState.create({
        doc: defaultMarkdownParser.parse(content)||undefined,
        schema:mySchema,
        plugins:[
          keymap({'Mod-z':undo,'Mod-y':redo}),
          keymap(baseKeymap),
          buildInputRules(mySchema),
          
        ]
      })
    });
  }

  get content() {
    return defaultMarkdownSerializer.serialize(this.view.state.doc)
  }
  focus() { this.view.focus() }
  destroy() { this.view.destroy() }

}