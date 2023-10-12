<template>
    <div data-tauri-drag-region class="titlebar-bg macos" os="macos"  :style="`--titlbarSidebarWidth: ${appStore.sidebar.visible?'var(--sidebarWidth)':'0'}`">
        <div data-tauri-drag-region class="titlebar">
            <div data-tauri-drag-region class="titlebar-info">
                <span data-tauri-drag-region class="marknote-title" 
                    :title="appStore.filepath || ''">{{ appStore.title ||'Untitled.md' }}</span>
                <span :class="{'not-save':appStore.isSave!==true}"></span>
            </div>
            
            <div class="titlebar-toolbar">
                <div class="titlebar-tool"  :class="{ open: menuStore.visible }" @click="menuStore.visible = !menuStore.visible">
                    <HamburgerButton theme="filled" />
                </div>

            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { HamburgerButton } from '@icon-park/vue-next';
import { useMenuStore } from '../../store/menu';
import { useAppStore } from '../../store/app';


const menuStore = useMenuStore();
const appStore = useAppStore();

</script>
  
<style lang="scss">
//--titlebarBgHover --titleBarHeight --editorBgColor
.titlebar-bg.macos{
    --editorBgColor: var(--contentBackgroundColor);
    --titlebarBgHover: var(--menuBackgroundColor);
    --barHeight: var(--titleBarHeight, 30px);
    height: var(--barHeight);
    // background: var(--editorBgColor, #ffffff);
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;

    .titlebar {
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        background: linear-gradient(to right, var(--primaryBackgroundColor) 0, var(--primaryBackgroundColor) var(--titlbarSidebarWidth,0), var(--contentBackgroundColor,#ffffff) var(--titlbarSidebarWidth,0), var(--contentBackgroundColor,#ffffff) 100%) !important;
        width: 100vw;
        height: var(--barHeight);
        box-sizing: border-box;
        left: 0;
        top: 0;
        right: 0;
        z-index: 2;
        transition: color .4s ease-in-out;
        overflow: hidden;
        cursor: default;

        .titlebar-info {
            width: 100%;
            height: var(--barHeight);
            line-height: var(--barHeight);
            text-align: center;
            z-index: 2;
            box-sizing: border-box;
            overflow: hidden;
            padding: 0 calc(var(--barHeight) * 3);

            .marknote-title {
                mix-blend-mode: difference;
                color: rgba(255, 255, 255, 0.7);
                // &.not-save::after{
                //     content: '';
                //     display: inline-block;
                //     width: 10px;
                //     height: 10px;
                //     margin-left: 4px;
                //     background-color:var(--notSavedColor,rgb(66, 212, 21));
                //     border-radius: 50%;
                // }

                &+span.not-save{
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    margin-left: 4px;
                    background-color:var(--notSavedColor,rgb(66, 212, 21));
                    border-radius: 50%;
                }
            }
        }

        .titlebar-toolbar {
            position: absolute;
            left: calc(100% - var(--barHeight));
            top: 0;
            height: var(--barHeight);
            width: var(--barHeight);

            &>.titlebar-tool {
                height: 100%;
                width: 100%;
                line-height: var(--barHeight);
                text-align: center;
                cursor: pointer;
                z-index: 3;
                transition: .4s ease-in-out;

                &:hover {
                    transform: rotate(90deg);

                }

                &.open {
                    transform: rotate(90deg);
                    background: var(--titlebarBgHover, #dfdfdf);
                }
            }

        }

    }
}</style>