import { Extension, extensions } from '@tiptap/core';
import { MarkdownTightLists } from "./extensions/tiptap/tight-lists";
import { MarkdownSerializer } from "./serialize/MarkdownSerializer";
import { MarkdownParser } from "./parse/MarkdownParser";
import { MarkdownClipboard } from "./extensions/tiptap/clipboard";


function _runTask(task,callback){
    const start=Date.now();
    requestAnimationFrame(()=>{
        if(Date.now()-start>16.6){
            task();
            callback();
        }else{
            _runTask();
        }
    });
}

function runTask(task){
    return new Promise((resolve)=>{
        _runTask(task,resolve);

    });
}

export const Markdown = Extension.create({
    name: 'markdown',
    priority: 50,
    addOptions() {
        return {
            html: true,
            tightLists: true,
            tightListClass: 'tight',
            bulletListMarker: '-',
            linkify: false,
            breaks: false,
            transformPastedText: false,
            transformCopiedText: false,
        }
    },
    addCommands() {
        const commands = extensions.Commands.config.addCommands();
        return {
            setContent: (content, emitUpdate, parseOptions) => (props) => {
                console.log(content);
                // debugger;
                const html=props.editor.storage.markdown.parser.parse(content);
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                // const items=doc.body.children;
                // debugger;
                // items.forEach(async (item)=>{
                //     await runTask(()=>{
                //         console.log(Date.now());
                //         commands.insertContent(item,emitUpdate,parseOptions);
                //     });
                // });
                
                
                console.log(doc);
                return commands.setContent(
                    html,
                    emitUpdate,
                    parseOptions
                )(props);
                // return true;
            },
            insertContentAt: (range, content, options) => (props) => {
                return commands.insertContentAt(
                    range,
                    props.editor.storage.markdown.parser.parse(content, { inline: true }),
                    options
                )(props);
            },
        }
    },
    onBeforeCreate() {
        this.editor.storage.markdown = {
            options: { ...this.options },
            parser: new MarkdownParser(this.editor, this.options),
            serializer: new MarkdownSerializer(this.editor),
            getMarkdown: () => {
                return this.editor.storage.markdown.serializer.serialize(this.editor.state.doc);
            },
        }
        this.editor.options.initialContent = this.editor.options.content;
        this.editor.options.content = this.editor.storage.markdown.parser.parse(this.editor.options.content);
    },
    onCreate() {
        this.editor.options.content = this.editor.options.initialContent;
        delete this.editor.options.initialContent;
    },
    addStorage() {
        return {
            /// storage will be defined in onBeforeCreate() to prevent initial object overriding
        }
    },
    addExtensions() {
        return [
            MarkdownTightLists.configure({
                tight: this.options.tightLists,
                tightClass: this.options.tightListClass,
            }),
            MarkdownClipboard.configure({
                transformPastedText: this.options.transformPastedText,
                transformCopiedText: this.options.transformCopiedText,
            }),
        ]
    },
});
