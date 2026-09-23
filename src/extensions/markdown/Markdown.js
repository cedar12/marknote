import { Extension, extensions } from '@tiptap/core';
import { MarkdownTightLists } from "./extensions/tiptap/tight-lists";
import { MarkdownSerializer } from "./serialize/MarkdownSerializer";
import { MarkdownParser } from "./parse/MarkdownParser";
import { MarkdownClipboard } from "./extensions/tiptap/clipboard";
import {elementFromString} from './util/dom';


function _runTask(task,callback){
    const start=Date.now();
    requestAnimationFrame(()=>{
        if(Date.now()-start>16.6){
            task();
            callback();
        }else{
            _runTask(task,callback);
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
                let s=Date.now();
                const html=props.editor.storage.markdown.parser.parse(content);
                console.log('解析耗时',Date.now()-s);
                return commands.setContent(
                    html,
                    emitUpdate,
                    parseOptions
                )(props);
            },
            insertContentLazy:(content, emitUpdate, parseOptions)=>(props) =>{
                console.log(content);
                commands.setContent(
                        '',
                        emitUpdate,
                        parseOptions
                )(props);
                // debugger;
                // const parser = new DOMParser();
                // setTimeout(()=>{
                const html=props.editor.storage.markdown.parser.parse(content);
                const doc=elementFromString(html);
                const items=doc.children;
                async function add(items,props){
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const html=item.outerHTML;
                        await runTask(()=>{
                            console.log(html);
                            commands.insertContent(html)(props);
                        });
                    }
                }
                add(items,props);
                    // console.log(doc,doc.children);
                // },100);
                
                // return commands.setContent(
                //     '',
                //     emitUpdate,
                //     parseOptions
                // )(props);
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
