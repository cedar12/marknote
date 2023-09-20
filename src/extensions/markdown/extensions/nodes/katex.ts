import { MarkdownSerializerState } from "@tiptap/pm/markdown";
import { Node as ProseMirrorNode } from 'prosemirror-model';
import {Katex} from '../../../katex';

export default Katex.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
                    state.write("$$");
                    state.ensureNewLine();
                    state.text(node.attrs.text, false);
                    state.ensureNewLine();
                    state.write("$$");
                    state.closeBlock(node);
                },
                parse: {
                },
            }
        }
    }
});
