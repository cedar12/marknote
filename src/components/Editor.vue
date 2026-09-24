<template>
  <nav v-if="segmented" class="segment-navigation" :aria-label="t('largeFileNavigation')">
    <span class="segment-mode">{{ t('largeFileMode') }}</span>
    <span class="segment-position" aria-live="polite">
      {{ t('segmentPosition', { current: segmentIndex + 1, total: segmentCount }) }}
    </span>
    <span v-if="segmentNavigationMode === 'scroll'" class="segment-scroll-hint">{{ t('segmentScrollHint') }}</span>
    <button v-if="segmentNavigationMode === 'buttons'" type="button" :disabled="navigating || editorStore.loading || editorStore.renderingDocument || appStore.exporting || segmentIndex === 0" @click="changeSegment(segmentIndex - 1, 'end')">
      {{ t('previousSegment') }}
    </button>
    <button v-if="segmentNavigationMode === 'buttons'" type="button" :disabled="navigating || editorStore.loading || editorStore.renderingDocument || appStore.exporting || segmentIndex >= segmentCount - 1" @click="changeSegment(segmentIndex + 1, 'start')">
      {{ t('nextSegment') }}
    </button>
  </nav>
  <!-- <LinkMenu :editor="editor"></LinkMenu> -->
  <Menu></Menu>
  <EditorContent :editor="editor" ></EditorContent>
</template>
<script lang="ts" setup> 
import {computed,onBeforeUnmount,onMounted,onUpdated,ref,watch,nextTick} from 'vue';
import {EditorContent} from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor';
import {useAppStore} from '../store/app';
import {usePreferencesStore} from '../store/preferences';
import { storeToRefs } from 'pinia';
import Menu from '../extensions/menu/index.vue';
import { useI18n } from 'vue-i18n';
import { createEditor } from '../utils/editor';
import * as appLog from '@tauri-apps/plugin-log';

const appStore=useAppStore();
const editorStore=useEditorStore();
const preferencesStore=usePreferencesStore();
const {t}=useI18n();

const editor=createEditor();
const {segmented,segmentIndex,segmentCount} = storeToRefs(editorStore);
const segmentNavigationMode=computed(()=>preferencesStore.editor.segmentNavigationMode);
const navigating=ref(false);
const AUTO_SWITCH_GUARD_MS=400;
const EDGE_TOLERANCE_PX=2;
let scrollContainer:HTMLElement|null=null;
let scrollbarRoot:HTMLElement|null=null;
let lastScrollTop=0;
let inputDirection:-1|0|1=0;
let inputExpiresAt=0;
let draggingScrollbar=false;
let lastTouchY:number|null=null;
let lastAutomaticSwitchAt=-Infinity;
let endAnchorObserver:ResizeObserver|null=null;

const stopEndAnchor=()=>{
  endAnchorObserver?.disconnect();
  endAnchorObserver=null;
};

const anchorSegmentEnd=()=>{
  stopEndAnchor();
  const content=editor.value?.view.dom;
  if(!scrollContainer || !content)return;
  endAnchorObserver=new ResizeObserver(()=>{
    if(!scrollContainer)return;
    scrollContainer.scrollTop=scrollContainer.scrollHeight;
    lastScrollTop=scrollContainer.scrollTop;
  });
  endAnchorObserver.observe(content);
};

const changeSegment = async (index:number, focusPosition:'start'|'end', automatic=false) => {
  if(navigating.value || editorStore.loading || editorStore.renderingDocument || appStore.exporting || index<0 || index>=segmentCount.value || index===segmentIndex.value)return;
  stopEndAnchor();
  navigating.value=true;
  try{
    const changed=await editorStore.showSegment(index, focusPosition);
    if(!changed)return;
    await nextTick();
    if(scrollContainer){
      scrollContainer.scrollTop=focusPosition==='end'?scrollContainer.scrollHeight:0;
      lastScrollTop=scrollContainer.scrollTop;
      if(focusPosition==='end')anchorSegmentEnd();
    }
    if(automatic)lastAutomaticSwitchAt=performance.now();
  }catch(error){
    appLog.error(`segment navigation failed: ${String(error)}`);
  }finally{
    draggingScrollbar=false;
    inputDirection=0;
    navigating.value=false;
  }
};

const checkScrollBoundary=(direction:-1|1)=>{
  if(!scrollContainer || !segmented.value || segmentNavigationMode.value!=='scroll' || navigating.value || editorStore.loading || editorStore.renderingDocument || appStore.exporting)return;
  if(performance.now()-lastAutomaticSwitchAt<AUTO_SWITCH_GUARD_MS)return;
  const atTop=scrollContainer.scrollTop<=EDGE_TOLERANCE_PX;
  const atBottom=scrollContainer.scrollTop+scrollContainer.clientHeight>=scrollContainer.scrollHeight-EDGE_TOLERANCE_PX;
  if(direction>0 && atBottom && segmentIndex.value<segmentCount.value-1){
    void changeSegment(segmentIndex.value+1,'start',true);
  }else if(direction<0 && atTop && segmentIndex.value>0){
    void changeSegment(segmentIndex.value-1,'end',true);
  }
};

const queueScrollInput=(direction:-1|1)=>{
  stopEndAnchor();
  inputDirection=direction;
  inputExpiresAt=performance.now()+250;
  requestAnimationFrame(()=>checkScrollBoundary(direction));
};

const onWheel=(event:WheelEvent)=>{
  if(event.defaultPrevented || event.ctrlKey || event.deltaY===0 || !scrollContainer)return;
  const target=event.target;
  if(target instanceof Element && target.closest('.el-scrollbar__wrap')!==scrollContainer)return;
  queueScrollInput(event.deltaY>0?1:-1);
};

const onTouchStart=(event:TouchEvent)=>{
  stopEndAnchor();
  lastTouchY=event.touches.length===1?event.touches[0].clientY:null;
};

const onTouchMove=(event:TouchEvent)=>{
  if(lastTouchY===null || event.touches.length!==1)return;
  const target=event.target;
  if(target instanceof Element && target.closest('.el-scrollbar__wrap')!==scrollContainer)return;
  const currentY=event.touches[0].clientY;
  const movement=lastTouchY-currentY;
  lastTouchY=currentY;
  if(Math.abs(movement)>=2)queueScrollInput(movement>0?1:-1);
};

const onTouchEnd=()=>{lastTouchY=null;};

const onPageKey=(event:KeyboardEvent)=>{
  stopEndAnchor();
  if(event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)return;
  if(event.key!=='PageDown' && event.key!=='PageUp')return;
  const target=event.target;
  if(target instanceof Element && target.closest('input, textarea, select'))return;
  if(target instanceof Element && target.closest('.el-scrollbar__wrap')!==scrollContainer)return;
  queueScrollInput(event.key==='PageDown'?1:-1);
};

const onScroll=()=>{
  if(!scrollContainer)return;
  const top=scrollContainer.scrollTop;
  const direction=top>lastScrollTop?1:top<lastScrollTop?-1:0;
  lastScrollTop=top;
  if(!direction)return;
  if(draggingScrollbar || (direction===inputDirection && performance.now()<inputExpiresAt)){
    checkScrollBoundary(direction);
  }
};

const onScrollbarPointerDown=(event:PointerEvent)=>{
  stopEndAnchor();
  const target=event.target;
  const bar=target instanceof Element?target.closest('.el-scrollbar__bar'):null;
  if(bar?.closest('.el-scrollbar')===scrollbarRoot)draggingScrollbar=true;
};

const stopScrollbarDrag=()=>{draggingScrollbar=false;};

const bindScrollListeners=()=>{
  const wrap=editor.value?.view.dom.closest('.el-scrollbar__wrap') as HTMLElement|null;
  if(!wrap || wrap===scrollContainer)return;
  scrollContainer?.removeEventListener('wheel',onWheel);
  scrollContainer?.removeEventListener('touchstart',onTouchStart);
  scrollContainer?.removeEventListener('touchmove',onTouchMove);
  scrollContainer?.removeEventListener('touchend',onTouchEnd);
  scrollContainer?.removeEventListener('touchcancel',onTouchEnd);
  scrollContainer?.removeEventListener('keydown',onPageKey);
  scrollContainer?.removeEventListener('pointerdown',stopEndAnchor);
  scrollContainer?.removeEventListener('scroll',onScroll);
  scrollbarRoot?.removeEventListener('pointerdown',onScrollbarPointerDown);
  scrollContainer=wrap;
  scrollbarRoot=wrap.closest('.el-scrollbar') as HTMLElement|null;
  lastScrollTop=wrap.scrollTop;
  wrap.addEventListener('wheel',onWheel,{passive:true});
  wrap.addEventListener('touchstart',onTouchStart,{passive:true});
  wrap.addEventListener('touchmove',onTouchMove,{passive:true});
  wrap.addEventListener('touchend',onTouchEnd);
  wrap.addEventListener('touchcancel',onTouchEnd);
  wrap.addEventListener('keydown',onPageKey);
  wrap.addEventListener('pointerdown',stopEndAnchor);
  wrap.addEventListener('scroll',onScroll,{passive:true});
  scrollbarRoot?.addEventListener('pointerdown',onScrollbarPointerDown);
};

watch(editor,instance=>{
  editorStore.setEditor(instance);
  if(instance)void nextTick(bindScrollListeners);
},{immediate:true,flush:'sync'});
onUpdated(bindScrollListeners);

watch(segmentNavigationMode,()=>{
  stopEndAnchor();
  inputDirection=0;
  draggingScrollbar=false;
  lastTouchY=null;
  lastScrollTop=scrollContainer?.scrollTop??0;
});

onBeforeUnmount(()=>{
  stopEndAnchor();
  scrollContainer?.removeEventListener('wheel',onWheel);
  scrollContainer?.removeEventListener('touchstart',onTouchStart);
  scrollContainer?.removeEventListener('touchmove',onTouchMove);
  scrollContainer?.removeEventListener('touchend',onTouchEnd);
  scrollContainer?.removeEventListener('touchcancel',onTouchEnd);
  scrollContainer?.removeEventListener('keydown',onPageKey);
  scrollContainer?.removeEventListener('pointerdown',stopEndAnchor);
  scrollContainer?.removeEventListener('scroll',onScroll);
  scrollbarRoot?.removeEventListener('pointerdown',onScrollbarPointerDown);
  window.removeEventListener('pointerup',stopScrollbarDrag);
  window.removeEventListener('pointercancel',stopScrollbarDrag);
  editorStore.setEditor(undefined);
});

watch(()=>appStore.filepath,()=>{
  stopEndAnchor();
  inputDirection=0;
  draggingScrollbar=false;
  lastTouchY=null;
  lastScrollTop=scrollContainer?.scrollTop??0;
  editorStore.updateHeadings();
})

onMounted(()=>{
  window.addEventListener('pointerup',stopScrollbarDrag);
  window.addEventListener('pointercancel',stopScrollbarDrag);
  
/*
  const content=`
  # marknote
  所见即所得  🎉
  
  2. 1
  3. 2
  * [x] a
  * [x] b
  
  \`\`\` javascript
  console.log('marknote');
  \`\`\`

  > a~~bc~~

  ~~abc~~ **bold**

  |a |b |
  |:-|:-|
  |1 |2 |


  abc [baidu.com](https://www.baidu.com)
  \`\`\`rust
  fn main(){
    println!("marknote");
  }
  \`\`\`
  `;
  // console.log('mount editor',editor);

  */
  nextTick(async ()=>{
    try {
      await editorStore.flushPendingContent();
    } catch {
      return;
    }
    await nextTick();
    bindScrollListeners();
    editor.value?.commands.focus();
    editor.value?.on('update', editorStore.updateHeadings);
    editorStore.updateHeadings();
  })
  
})

</script>

<style lang="scss">
.segment-navigation {
  position: sticky;
  top: 0;
  z-index: 3;
  min-height: 34px;
  padding: 4px 12px;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--contentTextColor);
  background: var(--contentBackgroundColor);
  border-bottom: 1px solid var(--contentBorderColor);

  .segment-mode {
    font-weight: 600;
    white-space: nowrap;
  }

  .segment-position {
    margin-right: auto;
    color: var(--contentTextColor);
    font-size: 12px;
    white-space: nowrap;
  }

  .segment-scroll-hint {
    color: var(--contentTextColor);
    font-size: 12px;
  }

  button {
    min-height: 26px;
    padding: 2px 10px;
    border: 1px solid var(--contentBorderColor);
    border-radius: 4px;
    color: var(--contentTextColor);
    background: var(--contentBackgroundColor);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--contentBackgroundColorHover);
    }

    &:focus-visible {
      outline: 2px solid var(--primaryTextColor);
      outline-offset: 1px;
    }

    &:active:not(:disabled) {
      background: var(--contentBackgroundColorActive);
    }

    &:disabled {
      opacity: .45;
      cursor: default;
    }
  }
}
</style>
