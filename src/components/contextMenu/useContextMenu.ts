import { Icon } from "@icon-park/vue-next/lib/runtime";
import { Ref, WatchStopHandle, onMounted, onUnmounted, ref, watch } from "vue";
import { useEditorStore } from "../../store/editor";
export const useContextMenu = (containerRef: Ref<HTMLElement | undefined>) => {
    const showMenu = ref(false);
    const x = ref(0);
    const y = ref(0);

    var stopWatch: null | WatchStopHandle = null;

    const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showMenu.value = true;
        x.value = e.clientX;
        y.value = e.clientY;
    };

    const closeMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        showMenu.value = false;
    }

    onMounted(() => {
        const div = containerRef.value;
        const editor = useEditorStore();
        stopWatch = watch(() => editor.contextmenuEvent, () => {
            if (editor.contextmenuEvent)
                handleContextMenu(editor.contextmenuEvent);
        })
        div?.addEventListener("contextmenu", handleContextMenu);
        window.addEventListener("click", closeMenu, true);
        window.addEventListener("contextmenu", closeMenu, true);
    });
    onUnmounted(() => {
        if (stopWatch) {
            stopWatch();
        }
        const div = containerRef.value;
        div?.removeEventListener("contextmenu", handleContextMenu);
        window.removeEventListener("click", closeMenu, true);
        window.removeEventListener("contextmenu", closeMenu, true);
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