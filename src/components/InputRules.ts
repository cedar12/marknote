import { inputRules,InputRule,wrappingInputRule,textblockTypeInputRule } from "prosemirror-inputrules";
import { NodeType, Schema } from "prosemirror-model";

/// Given a blockquote node type, returns an input rule that turns `"> "`
/// at the start of a textblock into a blockquote.
export function blockQuoteRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*>\s$/, nodeType)
}

/// Given a list node type, returns an input rule that turns a number
/// followed by a dot at the start of a textblock into an ordered list.
export function orderedListRule(nodeType: NodeType) {
  return wrappingInputRule(/^(\d+)\.\s$/, nodeType, match => ({order: +match[1]}),
                           (match, node) => node.childCount + node.attrs.order == +match[1])
}

/// Given a list node type, returns an input rule that turns a bullet
/// (dash, plush, or asterisk) at the start of a textblock into a
/// bullet list.
export function bulletListRule(nodeType: NodeType) {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType)
}

/// Given a code block node type, returns an input rule that turns a
/// textblock starting with three backticks into a code block.
export function codeBlockRule(nodeType: NodeType) {
  return textblockTypeInputRule(/^```$/, nodeType)
}

/// Given a node type and a maximum level, creates an input rule that
/// turns up to that number of `#` characters followed by a space at
/// the start of a textblock into a heading whose level corresponds to
/// the number of `#` signs.
export function headingRule(nodeType: NodeType, maxLevel: number) {
  return textblockTypeInputRule(new RegExp("^(#{1," + maxLevel + "})\\s$"),
                                nodeType, match => ({level: match[1].length}))
}

export function buildInputRules(schema:Schema){
  const rules = [
    new InputRule(/~~(.+)~~/,(state,match,from,to)=>{
      const mark=state.schema.mark(schema.marks.del);
      const str=match[1];
      const node=state.schema.text(str,[mark]);
      return state.tr.replaceWith(from,to,node);
    }),
    new InputRule(/\[(.+?)\]\((.+?)\)/,(state,match,from,to)=>{
      const mark=state.schema.mark(schema.marks.link,{title:match[1],href:match[2]});
      const node=state.schema.text(match[1],[mark]);
      return state.tr.replaceWith(from,to,node);
    }),
    new InputRule(/\*{2}(.+?)\*/,(state,match,from,to)=>{
      const mark=state.schema.mark(schema.marks.strong);
      const str=match[1];
      const node=state.schema.text(str,[mark]);
      return state.tr.replaceWith(from,to,node);
    }),
    new InputRule(/\*(.+?)\*/,(state,match,from,to)=>{
      const mark=state.schema.mark(schema.marks.em);
      const str=match[1];
      const node=state.schema.text(str,[mark]);
      return state.tr.replaceWith(from,to,node);
    }),
    new InputRule(/^(\*{3}|\-{3}|_{3})/,(state,match,from,to)=>{
      const node=state.schema.node('horizontal_rule');
      const node2=state.schema.node('paragraph');
      return state.tr.replaceWith(from-1,to,[node,node2]);
    }),
  ];
  rules.push(blockQuoteRule(schema.nodes.blockquote));
  rules.push(orderedListRule(schema.nodes.ordered_list));
  rules.push(bulletListRule(schema.nodes.bullet_list));
  rules.push(codeBlockRule(schema.nodes.code_block));
  rules.push(headingRule(schema.nodes.heading, 6));
  return inputRules({rules});
}