import { MarkdownSerializerState } from "@tiptap/pm/markdown";
import { Node as ProseMirrorNode } from 'prosemirror-model';
import {InlineKatex} from '../../../inlineKatex';

export default InlineKatex.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
                    state.write("$");
                    state.text(node.attrs.text, false);
                    state.write("$");
                },
                parse: {},
            }
        }
    }
});
