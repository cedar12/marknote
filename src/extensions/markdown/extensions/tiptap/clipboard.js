import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMParser } from '@tiptap/pm/model';
import { elementFromString } from "../../util/dom";

export const MarkdownClipboard = Extension.create({
    name: 'markdownClipboard',
    priority: 1000,
    addOptions() {
        return {
            transformPastedText: false,
            transformCopiedText: false,
        }
    },
    addProseMirrorPlugins() {
        let plainTextPaste = false;
        return [
            new Plugin({
                key: new PluginKey('markdownClipboard'),
                props: {
                    handleDOMEvents: {
                        paste: () => {
                            plainTextPaste = false;
                            return false;
                        },
                    },
                    handlePaste: (view, event, slice) => {
                        const literal = plainTextPaste || !this.editor.storage.markdown.options.transformPastedText;
                        const plainText = plainTextPaste;
                        plainTextPaste = false;
                        const clipboard = event.clipboardData;
                        const html = clipboard?.getData('text/html');
                        const text = clipboard?.getData('text/plain') || clipboard?.getData('Text');
                        const containsFile = Array.from(clipboard?.items || []).some(item => item.kind === 'file');
                        if (!literal || (html && !plainText) || (!text && !plainText) || containsFile) return false;
                        // Tiptap paste rules react to uiEvent='paste'. Literal text must
                        // bypass those rules and the math handlers without losing paste metadata.
                        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView().setMeta('paste', true));
                        return true;
                    },
                    clipboardTextParser: (text, context, plainText) => {
                        plainTextPaste = plainText;
                        if(plainText || !this.editor.storage.markdown.options.transformPastedText) {
                            return null; // pasting with shift key prevents formatting
                        }
                        const parsed = this.editor.storage.markdown.parser.parse(text, { inline: true });
                        return DOMParser.fromSchema(this.editor.schema)
                            .parseSlice(elementFromString(parsed), { preserveWhitespace: true });
                    },
                    /**
                     * @param {import('prosemirror-model').Slice} slice
                     */
                    clipboardTextSerializer: (slice) => {
                        if(!this.editor.storage.markdown.options.transformCopiedText) {
                            return null;
                        }
                        return this.editor.storage.markdown.serializer.serialize(slice.content);
                    },
                },
            })
        ]
    }
})
