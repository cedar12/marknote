<template>
    <div ref="containerRef">
        <slot></slot>
        <Teleport to="body">
            <Transition @beforeEnter="handleBeforeEnter" @enter="handleEnter" @afterEnter="handleAfterEnter">
                <div v-if="showMenu" class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
                    <div class="menu-list">
                        <div @click="handleClick(item)" class="menu-item" :class="{'disabled':item.disabled===true,'split':item.split===true}" v-for="item in props.menu" :key="item.label">
                            {{ item.label }}
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import {useContextMenu,ContextMenuItem} from './useContextMenu';
const props = defineProps({
    menu: {
        type: Array<ContextMenuItem>,
        default: () => [],
    },
});
const containerRef = ref<HTMLElement>();
const emit = defineEmits(['select']);
const { x, y, showMenu } = useContextMenu(containerRef);

function handleClick(item:ContextMenuItem) {
    showMenu.value = false;
    emit('select', item);
}

function handleBeforeEnter(el:Element) {
    (el as HTMLElement).style.height = '0';
}

function handleEnter(e:Element) {
    const el=e as HTMLElement;
    el.style.height = 'auto';
    const h = el.clientHeight;
    el.style.height = '0';
    requestAnimationFrame(() => {
        el.style.height = h + 'px';
        el.style.transition = '.5s';
    });
}

function handleAfterEnter(e:Element) {
    const el=e as HTMLElement;
    el.style.transition = 'none';
}
</script>
<style lang="scss">
.context-menu{
    position: fixed;
    min-width: 150px;
    --borderRadius: 4px;
    .menu-list{
        z-index: 997;
        font-size: 1rem;
        
        background-color: var(--menuBackgroundColor, #fff);
        color: var(--menuColor,#202124);
        box-shadow: 2px 2px 13px var(--menuShadow,#b8b8b8);
        border-radius: var(--borderRadius);
        .menu-item{
            padding: .2rem 1rem;
            cursor:pointer;
            &:hover{
                background-color: #e8e8e9;
            }
            &.disabled{
                color: #dfdfdf;
            }
            &.split{
                border-bottom: 1px solid #dfdfdf;
            }
        }
    }
}
</style>