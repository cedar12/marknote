import { Ref,  onMounted, onUnmounted, ref } from "vue";

type MaxWidthFn=()=>number;

export interface  DragSidebarOps{
  minWidth:number;
  maxWidth:number|MaxWidthFn;
}

export const useDragSidebar = (resizeRef: Ref<HTMLElement | undefined>,ops:DragSidebarOps={minWidth:220,maxWidth:()=>document.body.clientWidth-90}) => {
    const width = ref(ops.minWidth);
    const down = ref(false);

    function handleMouseDown(ev:MouseEvent){
      down.value=true;
      // document.body.style.cursor='col-resize';
    }
    function handleMouseUp(ev:MouseEvent){
      down.value=false;
      // document.body.style.cursor='none';
    }

    function handleMouseMove(ev:MouseEvent){
      if(!down.value)return;
      let x=ev.clientX;
      if(x<ops.minWidth){
        width.value=ops.minWidth;
      }else{
        width.value=x;
      }
      let maxWidth:number;
      if(typeof ops.maxWidth==='function'){
        maxWidth=ops.maxWidth();
      }else{
        maxWidth=ops.maxWidth;
      }
      if(x>maxWidth){
        width.value=maxWidth;
      }
    }

    onMounted(() => {
      const resize = resizeRef.value;
      resize?.addEventListener('mousedown',handleMouseDown);
      document.addEventListener('mouseup',handleMouseUp);
      document.addEventListener('mousemove',handleMouseMove);
    });
    onUnmounted(() => {
      const resize = resizeRef.value;
      resize?.removeEventListener('mousedown',handleMouseDown);
      document.removeEventListener('mouseup',handleMouseUp);
      document.removeEventListener('mousemove',handleMouseMove);
    });
    return {
        width,
    };
}
