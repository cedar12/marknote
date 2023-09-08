
import {
  DecorationWithType,
  NodeView,
  NodeViewProps,
  NodeViewRenderer,
  NodeViewRendererOptions,
  NodeViewRendererProps,
} from '@tiptap/core'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, NodeView as ProseMirrorNodeView } from '@tiptap/pm/view'
import { Editor } from '@tiptap/core'
import {
  Component,
  defineComponent,
  PropType,
  provide,
  Ref,
  ref,
} from 'vue'
import { VueNodeViewRendererOptions, VueRenderer } from '@tiptap/vue-3'


class VueNodeView extends NodeView<Component, Editor, VueNodeViewRendererOptions> {
  renderer!: VueRenderer

  decorationClasses!: Ref<string>

  mount() {
    const props: NodeViewProps = {
      editor: this.editor,
      node: this.node,
      decorations: this.decorations,
      selected: false,
      extension: this.extension,
      getPos: () => this.getPos(),
      updateAttributes: (attributes = {}) => this.updateAttributes(attributes),
      deleteNode: () => this.deleteNode(),
    }

    const onDragStart = this.onDragStart.bind(this)

    this.decorationClasses = ref(this.getDecorationClasses())

    const extendedComponent = defineComponent({
      extends: { ...this.component },
      props: Object.keys(props),
      template: (this.component as any).template,
      setup: reactiveProps => {
        provide('onDragStart', onDragStart)
        provide('decorationClasses', this.decorationClasses)

        return (this.component as any).setup?.(reactiveProps, {
          expose: () => undefined,
        })
      },
      // add support for scoped styles
      // @ts-ignore
      // eslint-disable-next-line
      __scopeId: this.component.__scopeId,
      // add support for CSS Modules
      // @ts-ignore
      // eslint-disable-next-line
      __cssModules: this.component.__cssModules,
      // add support for vue devtools
      // @ts-ignore
      // eslint-disable-next-line
      __name: this.component.__name,
      // @ts-ignore
      // eslint-disable-next-line
      __file: this.component.__file,
    })

    this.renderer = new VueRenderer(extendedComponent, {
      editor: this.editor,
      props,
    })
  }

  get dom() {
    if (!this.renderer.element.hasAttribute('data-node-view-wrapper')) {
      throw Error('Please use the NodeViewWrapper component for your node view.')
    }

    return this.renderer.element as HTMLElement
  }

  get contentDOM() {
    if (this.node.isLeaf) {
      return null
    }

    const contentElement = this.dom.querySelector('[data-node-view-content]')

    return (contentElement || this.dom) as HTMLElement | null
  }

  update(node: ProseMirrorNode, decorations: DecorationWithType[]) {
    const updateProps = (props?: Record<string, any>) => {
      this.decorationClasses.value = this.getDecorationClasses()
      this.renderer.updateProps(props)
    }

    if (typeof this.options.update === 'function') {
      const oldNode = this.node
      const oldDecorations = this.decorations

      this.node = node
      this.decorations = decorations

      return this.options.update({
        oldNode,
        oldDecorations,
        newNode: node,
        newDecorations: decorations,
        updateProps: () => updateProps({ node, decorations }),
      })
    }

    if (node.type !== this.node.type) {
      return false
    }

    if (node === this.node && this.decorations === decorations) {
      return true
    }

    this.node = node
    this.decorations = decorations

    updateProps({ node, decorations })

    return true
  }

  selectNode() {
    this.renderer.updateProps({
      selected: true,
    })
  }

  deselectNode() {
    this.renderer.updateProps({
      selected: false,
    })
  }

  getDecorationClasses() {
    return (
      this.decorations
        // @ts-ignore
        .map(item => item.type.attrs.class)
        .flat()
        .join(' ')
    )
  }

  destroy() {
    this.renderer.destroy()
  }
}


export function VueNodeViewRenderer(
  component: Component,
  options?: Partial<VueNodeViewRendererOptions>,
): NodeViewRenderer {
  return (props: NodeViewRendererProps) => {
    return new VueNodeView(component, props, options) as unknown as ProseMirrorNodeView
  }
}