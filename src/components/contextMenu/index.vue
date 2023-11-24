<template>
    <div ref="containerRef">
        <slot></slot>
        <Teleport to="body">
            <div class="context-menu-wrapper"  v-if="showMenu">
                <div class="context-menu-mask" @click="hide" @contextmenu.prevent="hide"></div>
                <Transition @beforeEnter="handleBeforeEnter" @enter="handleEnter" @afterEnter="handleAfterEnter">
                    <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }" @contextmenu.prevent="">
                        <div class="menu-list glass">
                            <div @click="handleClick($event,item)" class="menu-item" :class="{'disabled':disabled(item),'split':item.split===true}" v-for="item in props.menu" :key="item.label">
                                {{ item.label }}
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </Teleport>
    </div>
</template>
<script lang="ts" setup>
import {  ref } from 'vue';
import {useContextMenu,ContextMenuItem} from './useContextMenu';
const props = defineProps({
    menu: {
        type: Array<ContextMenuItem>,
        default: () => [],
    }
});

const menus=ref(props.menu);
const containerRef = ref<HTMLElement>();
const emit = defineEmits(['select']);
const { x, y, showMenu } = useContextMenu(containerRef,menus);

function hide(e:MouseEvent){
    e.preventDefault();
    showMenu.value=false;
}

function disabled(item:ContextMenuItem){
    if(item.disabled!==undefined){
        if(item.disabled===true){
            return true;
        }

        if(typeof item.disabled==='function'){
            const result=item.disabled();
            if(result===true){
                return true;
            }
        }
        
        
    }
    return false;
}

function handleClick(e:MouseEvent,item:ContextMenuItem) {
    e.preventDefault();
    e.stopPropagation();
    if((e.target as HTMLElement).classList.contains('disabled')){
        return;
    }
    showMenu.value = false;
    if(item.onClick){
        item.onClick(item);
    }else{
        emit('select', item);
    }
    
}

function handleBeforeEnter(el:Element) {
    (el as HTMLElement).style.height = '0px';
}

function handleEnter(e:Element) {
    const el=e as HTMLElement;
    el.style.height = 'auto';
    const h = el.clientHeight;
    el.style.height = '0px';
    requestAnimationFrame(() => {
        el.style.height = h + 'px';
        el.style.transition = '5s';
    });
}

function handleAfterEnter(e:Element) {
    const el=e as HTMLElement;
    el.style.transition = 'none';
}
</script>
<style lang="scss">
.context-menu-wrapper{
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9999;
    .context-menu-mask{
        position: absolute;
        width: 100%;
        height: 100%;
    }
    .context-menu{
        position: absolute;
        min-width: 150px;
        --borderRadius: 4px;
        user-select: none;
        -webkit-user-select: none;
        .menu-list{
            z-index: 997;
            font-size: 14px;
            background-color: var(--menuBackgroundColor, #fff);
            color: var(--menuTextColor,#202124);
            // box-shadow: 2px 2px 13px var(--menuShadowColor,#b8b8b8);
            // border: 1px solid var(--menuShadowColor);
            border: 1px solid var(--menuBorderColor);
            border-radius: var(--borderRadius);
            &.glass{
                background-color: transparent;
                &::before{
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: -1;
                    background-color: var(--menuBackgroundColorGlass);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                }
            }
            .menu-item{
                padding: .2rem 1rem;
                cursor:pointer;
                &:hover{
                    background-color: var(--menuBackgroundColorHover,#e8e8e9);
                }
                &.disabled{
                    color: var(--menuTextColorDisabled,#dfdfdf);;
                }
                &.split{
                    border-bottom: 1px solid var(--menuBorderColor);
                }
            }
        }
    }
}
</style>