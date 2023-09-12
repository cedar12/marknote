import { Icon } from "@icon-park/vue-next/lib/runtime";
import { Ref,  onMounted, onUnmounted, ref } from "vue";

export const useContextMenu = (containerRef: Ref<HTMLElement | undefined>,menuRef:Ref<ContextMenuItem[]>) => {
    const showMenu = ref(false);
    const x = ref(0);
    const y = ref(0);

    var w = window.innerWidth;
    var h = window.innerHeight;
    const width=150;

    const handleContextMenu = (e: MouseEvent) => {
        console.log(e);
        e.preventDefault();
        e.stopPropagation();
        showMenu.value = true;
        
        const height=menuRef.value.length*30;

        console.log(w,h,width,height,e.clientX,e.clientY);
        x.value = e.clientX;
        if(w-width<x.value){
            x.value=x.value-width;
        }
        y.value = e.clientY;
        if(h-height<y.value){
            y.value=y.value-height;
        }
    };

    const resize=()=>{
        w=window.innerWidth;
        h=window.innerHeight;
    }

    onMounted(() => {
        const div = containerRef.value;
        div?.addEventListener("contextmenu", handleContextMenu);
        // window.addEventListener("click", closeMenu, true);
        // window.addEventListener("contextmenu", closeMenu, true);
        window.addEventListener('resize',resize);
    });
    onUnmounted(() => {
        window.removeEventListener('resize',resize);
        const div = containerRef.value;
        div?.removeEventListener("contextmenu", handleContextMenu);
        // window.removeEventListener("click", closeMenu, true);
        // window.removeEventListener("contextmenu", closeMenu, true);
    });
    return {
        showMenu,
        x,
        y,
    };
}

export interface ContextMenuItem {
    label: string,
    value?: string,
    icon?: Icon,
    disabled?: boolean | (() => boolean | void),
    split?: boolean,

    onClick?: (menu: ContextMenuItem) => void,
}