import { Icon } from "@icon-park/vue-next/lib/runtime";
import { Ref, onMounted, onUnmounted, ref } from "vue";
export const useContextMenu=(containerRef: Ref<HTMLElement|undefined>)=>{
    const showMenu = ref(false);
    const x = ref(0);
    const y = ref(0);

    const handleContextMenu = (e:MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showMenu.value=true;
        x.value=e.clientX;
        y.value=e.clientY;
    };

    const closeMenu=()=>{
        showMenu.value=false;
    }

    onMounted(() => {
        const div = containerRef.value;
        div?.addEventListener("contextmenu",handleContextMenu);
        window.addEventListener("click",closeMenu,true);
        window.addEventListener("contextmenu",closeMenu,true);
    });
    onUnmounted(() => {
       const div=containerRef.value;
       div?.removeEventListener("contextmenu",handleContextMenu);
       window.removeEventListener("click",closeMenu,true);
       window.removeEventListener("contextmenu",closeMenu,true);
    });
    return {
        showMenu,
        x,
        y,
    };
}

export interface ContextMenuItem{
    label:string,
    icon?:Icon,
    disabled?:boolean,
    split?:boolean,
}