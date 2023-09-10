import { mergeAttributes } from '@tiptap/core';
import { Heading as BaseHeading } from '@tiptap/extension-heading';


export const Heading = BaseHeading.extend({
    
    renderHTML({ node, HTMLAttributes }) {
        const hasLevel = this.options.levels.includes(node.attrs.level);
        const level = hasLevel ? node.attrs.level : this.options.levels[0];
        
        var text=node.textContent;
        // // @ts-ignore
        // if(node.content.content.length>0){
        //     // @ts-ignore
        //     text=node.content.content[0].text;
        // }
        
        
        return [`h${level}`, mergeAttributes({id:text},this.options.HTMLAttributes, HTMLAttributes), 0];
    },
});