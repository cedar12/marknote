import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import Component from './wrapper/TableOfContents.vue'

export const TableOfContents = Node.create({
  name: 'tableOfContents',

  group: 'block',

  atom: true,

  parseHTML() {
    return [
      {
        tag: 'toc',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['toc', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return VueNodeViewRenderer(Component)
  },

  addGlobalAttributes() {
    return [
      {
        types: [
          'heading',
        ],
        attributes: {
          id: {
            default: null,
          },
        },
      },
    ]
  },
})