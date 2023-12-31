import { Fragment } from "@tiptap/pm/model";
import { getHTMLFromFragment, Mark } from "@tiptap/core";


export default Mark.create({
    name: 'markdownHTMLMark',
    /**
     * @return {{markdown: MarkdownMarkSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize: {
                    open(state, mark)  {
                        if(!this.editor.storage.markdown.options.html) {
                            console.warn(`Tiptap Markdown: "${mark.type.name}" mark is only available in html mode`);
                            return '';
                        }
                        return getMarkTags(mark)?.[0] ?? '';
                    },
                    close(state, mark) {
                        if(!this.editor.storage.markdown.options.html) {
                            return '';
                        }
                        return getMarkTags(mark)?.[1] ?? '';
                    },
                },
                parse: {
                    // handled by markdown-it
                }
            }
        }
    }
});

function getMarkTags(mark) {
    const schema = mark.type.schema;
    const node = schema.text(' ', [mark]);
    const html = getHTMLFromFragment(Fragment.from(node), schema);
    const match = html.match(/^(<.*?>) (<\/.*?>)$/);
    return match ? [match[1], match[2]] : null;
}
