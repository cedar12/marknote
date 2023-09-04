import {Schema, MarkSpec} from "prosemirror-model"

/// Document schema for the data model used by CommonMark.
export const schema = new Schema({
  nodes: {
    doc: {
      content: "block+"
    },

    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{tag: "p"}],
      toDOM() { return ["p",{class:'marknote-p'}, 0] }
    },

    blockquote: {
      content: "block+",
      group: "block",
      parseDOM: [{tag: "blockquote"}],
      toDOM() { return ["blockquote",{class:'marknote-blockquote'}, 0] }
    },

    horizontal_rule: {
      group: "block",
      parseDOM: [{tag: "hr"}],
      toDOM() { return ["div",{class:'marknote-hr'}, ["hr"]] }
    },

    heading: {
      attrs: {level: {default: 1}},
      content: "(text | image)*",
      group: "block",
      defining: true,
      parseDOM: [{tag: "h1", attrs: {level: 1}},
                 {tag: "h2", attrs: {level: 2}},
                 {tag: "h3", attrs: {level: 3}},
                 {tag: "h4", attrs: {level: 4}},
                 {tag: "h5", attrs: {level: 5}},
                 {tag: "h6", attrs: {level: 6}}],
      toDOM(node) { return ["h" + node.attrs.level,{class:'marknote-h'+node.attrs.level}, 0] }
    },

    code_block: {
      content: "text*",
      group: "block",
      code: true,
      defining: true,
      marks: "",
      attrs: {params: {default: ""}},
      parseDOM: [{tag: "pre", preserveWhitespace: "full", getAttrs: node => (
        {params: (node as HTMLElement).getAttribute("data-params") || ""}
      )}],
      toDOM(node) { return ["pre", node.attrs.params ? {class:'marknote-code',"data-params": node.attrs.params} : {class:'marknote-code'}, ["code", 0]] }
    },

    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: {order: {default: 1}, tight: {default: false}},
      parseDOM: [{tag: "ol", getAttrs(dom) {
        return {order: (dom as HTMLElement).hasAttribute("start") ? +(dom as HTMLElement).getAttribute("start")! : 1,
                tight: (dom as HTMLElement).hasAttribute("data-tight")}
      }}],
      toDOM(node) {
        return ["ol", {class:'marknote-order-list',start: node.attrs.order == 1 ? null : node.attrs.order,
                       "data-tight": node.attrs.tight ? "true" : null}, 0]
      }
    },

    bullet_list: {
      content: "(list_item|task_item)+",
      group: "block",
      attrs: {tight: {default: false}},
      parseDOM: [{tag: "ul", getAttrs: dom => ({tight: (dom as HTMLElement).hasAttribute("data-tight")})}],
      toDOM(node) { return ["ul", {class:'marknote-unorder-list',"data-tight": node.attrs.tight ? "true" : null}, 0] }
    },
    task_item: {
      content: "block+",
      attrs: {checked: {default: false}},
      defining: true,
      parseDOM: [{tag: "input"}],
      toDOM(node) { return ["li",{class:'marknote-task-li'}, "input",{type:'checkbox',checked:node.attrs.checked},0] }
    },

    list_item: {
      content: "block+",
      defining: true,
      parseDOM: [{tag: "li"}],
      toDOM() { return ["li",{class:'marknote-li'}, 0] }
    },

    text: {
      group: "inline"
    },

    image: {
      inline: true,
      attrs: {
        src: {},
        alt: {default: null},
        title: {default: null}
      },
      group: "inline",
      draggable: true,
      parseDOM: [{tag: "img[src]", getAttrs(dom) {
        return {
          src: (dom as HTMLElement).getAttribute("src"),
          title: (dom as HTMLElement).getAttribute("title"),
          alt: (dom as HTMLElement).getAttribute("alt")
        }
      }}],
      toDOM(node) { return ["img",{class:'marknote-image'}, node.attrs] }
    },

    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{tag: "br"}],
      toDOM() { return ["br",{class:'marknote-br'}] }
    }
  },

  marks: {
    em: {
      parseDOM: [
        {tag: "i"}, {tag: "em"},
        {style: "font-style=italic"},
        {style: "font-style=normal", clearMark: m => m.type.name == "em"}
      ],
      toDOM() { return ["em",{class:'marknote-em'}] }
    },

    strong: {
      parseDOM: [
        {tag: "strong"},
        {tag: "b", getAttrs: (node: HTMLElement) => node.style.fontWeight != "normal" && null},
        {style: "font-weight=400", clearMark: m => m.type.name == "strong"},
        {style: "font-weight", getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null}
      ],
      toDOM() { return ["strong",{class:'marknote-strong'}] }
    } as MarkSpec,

    link: {
      attrs: {
        href: {},
        title: {default: null}
      },
      inclusive: false,
      parseDOM: [{tag: "a[href]", getAttrs(dom) {
        return {href: (dom as HTMLElement).getAttribute("href"), title: (dom as HTMLElement).getAttribute("title")}
      }}],
      toDOM(node) { return ["a", {class:'marknote-link',...node.attrs}] }
    },

    code: {
      parseDOM: [{tag: "code"}],
      toDOM() { return ["code", {class:'marknote-link'}] }
    },

    del: {
      parseDOM: [{tag: "del"}],
      toDOM() { return ["del", {class:'marknote-del'}] }
    }
  }
})