<template>
    <div ref="containerRef">
        <slot></slot>
        <Teleport to="body">
            <div class="context-menu-wrapper"  v-if="showMenu">
                <div class="context-menu-mask" @click="hide" @contextmenu="hide"></div>
                <Transition @beforeEnter="handleBeforeEnter" @enter="handleEnter" @afterEnter="handleAfterEnter">
                    <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
                        <div class="menu-list">
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
const containerRef = ref<HTMLElement>();
const emit = defineEmits(['select']);
const { x, y, showMenu } = useContextMenu(containerRef);

function hide(e:MouseEvent){
    e.preventDefault();
    showMenu.value=false;
}

function disabled(item:ContextMenuItem){
    if(item.disabled!==undefined){
        if(item instanceof Boolean){
            if(item.disabled===true){
                return true;
            }
        }
        // @ts-ignore
        const result=item.disabled();
        if(result===true){
            return true;
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
.context-menu-wrapper{
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 980;
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
}
</style>