import { Node } from "@tiptap/core";
import { defaultMarkdownSerializer } from "prosemirror-markdown";


const Heading = Node.create({
    name: 'heading',
});

export default Heading.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize: defaultMarkdownSerializer.nodes.heading,
                parse: {
                    // handled by markdown-it
                    updateDOM(element) {
                        const h1s=element.querySelectorAll('h1,h2,h3,h4,h5,h6');
                        h1s.forEach(h=>h.id=h.innerText);
                    },
                },
            }
        }
    }
});
