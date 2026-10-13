import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { clampSidebarWidth, DEFAULT_SIDEBAR_WIDTH, normalizeSidebarWidth, SIDEBAR_WIDTH_KEY, sidebarWidthBounds } from '../../utils/folderNavigation';

export interface DragSidebarOps {
  minWidth?: number;
  maxWidth?: number | (() => number);
  initialWidth?: number;
  disabled?: () => boolean;
}

export const useDragSidebar = (resizeRef: Ref<HTMLElement | undefined>, ops: DragSidebarOps = {}) => {
  let remembered = normalizeSidebarWidth(ops.initialWidth);
  try { remembered = normalizeSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_KEY), remembered); } catch { /* Keep the existing in-memory width. */ }
  const preferredWidth = ref(remembered);
  const viewportWidth = ref(window.innerWidth);
  const storageError = ref(false);
  const dragging = ref(false);
  const bounds = computed(() => sidebarWidthBounds(viewportWidth.value, ops.minWidth,
    typeof ops.maxWidth === 'function' ? ops.maxWidth() : ops.maxWidth));
  const width = computed(() => clampSidebarWidth(preferredWidth.value, bounds.value.min, bounds.value.max));
  let pointerId: number | null = null;
  let startX = 0;
  let startWidth = 0;
  let dragTarget: HTMLElement | undefined;
  let previousCursor = '';

  function persist(): boolean {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(preferredWidth.value)); storageError.value = false; return true; }
    catch { storageError.value = true; return false; }
  }
  function setWidth(value: number) { preferredWidth.value = Math.round(clampSidebarWidth(value, bounds.value.min, bounds.value.max)); }
  function restoreDefault() { if (!ops.disabled?.()) { preferredWidth.value = DEFAULT_SIDEBAR_WIDTH; persist(); } }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId || !dragging.value) return;
    setWidth(startWidth + event.clientX - startX);
  }
  function finish() {
    if (!dragging.value) return;
    const id = pointerId;
    dragging.value = false;
    pointerId = null;
    document.body.style.cursor = previousCursor;
    if (id !== null && dragTarget?.hasPointerCapture?.(id)) {
      try { dragTarget.releasePointerCapture(id); } catch { /* A cancelled pointer can have lost capture already. */ }
    }
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    window.removeEventListener('blur', finish);
    persist();
  }
  function start(event: PointerEvent) {
    if (event.button !== 0 || dragging.value || ops.disabled?.()) return;
    event.preventDefault();
    dragging.value = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startWidth = width.value;
    dragTarget = event.currentTarget as HTMLElement;
    dragTarget.focus();
    previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'col-resize';
    try { dragTarget.setPointerCapture(event.pointerId); } catch { /* Window listeners also cover browsers without capture. */ }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    window.addEventListener('blur', finish);
  }
  function keydown(event: KeyboardEvent) {
    if (ops.disabled?.() || event.isComposing) return;
    const step = event.shiftKey ? 40 : 10;
    if (event.key === 'ArrowLeft') setWidth(width.value - step);
    else if (event.key === 'ArrowRight') setWidth(width.value + step);
    else if (event.key === 'Home') setWidth(bounds.value.min);
    else if (event.key === 'End') setWidth(bounds.value.max);
    else if (event.key === 'Enter') preferredWidth.value = DEFAULT_SIDEBAR_WIDTH;
    else return;
    event.preventDefault();
    event.stopPropagation();
    persist();
  }
  function resized() { viewportWidth.value = window.innerWidth; }
  window.addEventListener('resize', resized);
  const stopTarget = watch(resizeRef, (target, previous) => {
    previous?.removeEventListener('pointerdown', start);
    previous?.removeEventListener('keydown', keydown);
    previous?.removeEventListener('dblclick', restoreDefault);
    target?.addEventListener('pointerdown', start);
    target?.addEventListener('keydown', keydown);
    target?.addEventListener('dblclick', restoreDefault);
  }, { flush: 'post', immediate: true });
  watch(() => ops.disabled?.(), disabled => { if (disabled) finish(); });
  onBeforeUnmount(() => {
    finish();
    stopTarget();
    window.removeEventListener('resize', resized);
    resizeRef.value?.removeEventListener('pointerdown', start);
    resizeRef.value?.removeEventListener('keydown', keydown);
    resizeRef.value?.removeEventListener('dblclick', restoreDefault);
  });
  return { width, bounds, dragging, storageError, persist, restoreDefault };
};
