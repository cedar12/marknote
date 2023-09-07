<template>
    <div data-tauri-drag-region class="titlebar-bg macos" os="macos">
        <div data-tauri-drag-region class="titlebar">
            <div data-tauri-drag-region class="titlebar-info">
                <span data-tauri-drag-region class="marknote-title" :class="{ 'not-save': appStore.isSave !== true }"
                    :title="appStore.filepath || ''">{{ appStore.title || 'marknote' }}</span>
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
    background: var(--editorBgColor, #ffffff);
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;

    .titlebar {
        position: relative;
        user-select: none;
        background: transparent;
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
                &.not-save::after {
                    content: ' *';

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