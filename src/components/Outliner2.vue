<template>
    <div class="marknote-outliner" v-if="editorStore.editor">
        <!-- <button @click="handleClick">log</button> -->
        <div class="outliner-tree">
            <ElScrollbar height="100%">
                <div class="outliner-item" v-for="(heading,i) in headings" :key="i" @click="onClick(heading)">
                    <span :class="'level-'+heading.attrs?.level">{{ getText(heading) }}</span>
                </div>
            </ElScrollbar>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { JSONContent } from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor';
import {storeToRefs} from 'pinia';
import {ElScrollbar} from 'element-plus';
// import {Right} from '@icon-park/vue-next';

const editorStore=useEditorStore();
const {headings}=storeToRefs(editorStore);

// const onSelected=(node:any)=>{
//     console.log(node);
//     if(node.label!=''){
//         location.hash=node.value;
//     }
    
// }

const onClick=(heading:JSONContent)=>{
    console.log(heading,getText(heading));
    if(getText(heading)!=''){
        location.hash=heading.attrs?.id;
    }
    
}

const getText=(heading:JSONContent):string=>{
    const contents=heading.content||[];
    var text='';
    for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        text+=content.text;
    }
    return text;
}


</script>
<style lang="scss">
.marknote-outliner{
    background-color: var(--primaryBackgroundColor);
    color: var(--primaryTextColor);
    padding-top: var(--titleBarHeight);
    --el-fill-color-light: var(--primaryBackgroundColorHover);
    --el-fill-color-blank: var(--primaryBackgroundColor);
    --el-text-color-regular: var(--primaryTextColor);
    .outliner-tree{
        height: calc(100vh - var(--titleBarHeight));
        overflow: hidden;
        .outliner-item{
            padding: 2px 0 2px 20px;
            cursor: pointer;
            @for $i from 1 through 6{
                .level-#{$i}{
                    position: relative;
                    margin-left: 15px*$i;
                    &::after{
                        content: 'H#{$i}';
                        display: block;
                        position: absolute;
                        top: 0;
                        left: -18px;
                        font-size: .4em;
                        color: #abaeb1;
                    }
                }
            }
        }
    }
}
</style>