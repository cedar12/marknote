import { Node } from "@tiptap/core";


const CodeBlock = Node.create({
    name: 'codeBlock',
});

export default CodeBlock.extend({
    /**
     * @return {{markdown: MarkdownNodeSpec}}
     */
    addStorage() {
        return {
            markdown: {
                serialize(state, node) {
                    // A fence in the source must never close the surrounding block.
                    const language = String(node.attrs.language || "").replace(/[\r\n]/g, " ");
                    const character = language.includes("`") ? "~" : "`";
                    let longestRun = 0;
                    for (const match of node.textContent.matchAll(character === "`" ? /`+/g : /~+/g)) {
                        longestRun = Math.max(longestRun, match[0].length);
                    }
                    const fence = character.repeat(Math.max(3, longestRun + 1));
                    state.write(fence + language + "\n");
                    state.text(node.textContent, false);
                    state.ensureNewLine();
                    state.write(fence);
                    state.closeBlock(node);
                },
                parse: {
                    setup(markdownit) {
                        markdownit.set({
                            langPrefix: this.options.languageClassPrefix ?? 'language-',
                        });
                    },
                    updateDOM(element) {
                        element.innerHTML = element.innerHTML.replace(/\n<\/code><\/pre>/g, '</code></pre>')
                    },
                },
            }
        }
    }
});
