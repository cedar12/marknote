<template>
  <aside class="layout-sidebar" v-if="appStore.sidebar.visible" :inert="busy" :aria-label="t('sidebar')" :style="`--sidebarWidth:${width}px`">

    <div class="sidebar-menu">
      <button type="button" class="menu-item" :class="{ 'active': appStore.sidebar.active === 'outliner' }" :aria-label="t('outliner')" :title="t('outliner')" :aria-pressed="appStore.sidebar.active === 'outliner'" @click="changeActive('outliner')">
        <MindmapList aria-hidden="true" />
      </button>
      <button type="button" class="menu-item" :class="{ 'active': appStore.sidebar.active === 'folder' }" :aria-label="t('folder')" :title="t('folder')" :aria-pressed="appStore.sidebar.active === 'folder'" @click="changeActive('folder')">
        <Notes aria-hidden="true" />
      </button>
      <button type="button" class="menu-item" :class="{ 'active': appStore.sidebar.active === 'search' }" :aria-label="t('documentSearch')" :title="t('documentSearch')" :aria-pressed="appStore.sidebar.active === 'search'" @click="changeActive('search')"><Search aria-hidden="true" /></button>
      <div class="menu-bottom">
        <button type="button" :aria-label="t('restoreSidebarWidth')" :title="t('restoreSidebarWidth')" @click="restoreDefault"><Refresh aria-hidden="true" /></button>
        <button type="button" :aria-label="t('collapseSidebar')" :title="t('collapseSidebar')" @click="unexpand"><ExpandRight aria-hidden="true" /></button>
      </div>
    </div>
    <div class="sidebar-content">
      <div v-if="storageError" class="sidebar-width-error" role="alert">
        <span>{{ t('sidebarWidthSaveFailed') }}</span>
        <button type="button" @click="persist">{{ t('retry') }}</button>
      </div>
      <Toc v-show="appStore.sidebar.active === 'outliner'"></Toc>
      <FolderView v-show="appStore.sidebar.active === 'folder'"></FolderView>
      <DocumentSearch v-show="appStore.sidebar.active === 'search'" />
    </div>
  </aside>
  <div class="dragbar-resize" ref="resizeRef" :style="{ '--sidebarResizeWidth': `${SIDEBAR_RESIZE_WIDTH}px` }" :class="{'resize-visible':appStore.sidebar.visible, 'is-dragging':dragging}" role="separator" aria-orientation="vertical" :aria-label="t('resizeSidebar')" :aria-valuemin="bounds.min" :aria-valuemax="bounds.max" :aria-valuenow="width" :aria-valuetext="t('sidebarWidthValue', { width })" :aria-disabled="busy" :aria-hidden="!appStore.sidebar.visible" :tabindex="appStore.sidebar.visible && !busy ? 0 : -1" :title="t('sidebarResizeHint')"></div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Toc from '../Toc.vue';
import FolderView from '../Folder.vue';
import DocumentSearch from './DocumentSearch.vue';
import { useAppStore } from '../../store/app';
import { useEditorStore } from '../../store/editor';
import { Notes, MindmapList, ExpandRight, Refresh, Search } from '@icon-park/vue-next';
import { useDragSidebar } from './useDragSidebar';
import { SIDEBAR_RESIZE_WIDTH } from '../../utils/folderNavigation';

const resizeRef = ref<HTMLElement>();
const appStore = useAppStore();
const editorStore = useEditorStore();
const { t } = useI18n();
const busy = computed(() => !appStore.sidebar.visible || appStore.lifecycleBusy || appStore.exporting || editorStore.loading || editorStore.renderingDocument || editorStore.segmentLoading);

const { width, bounds, dragging, storageError, persist, restoreDefault } = useDragSidebar(resizeRef, { initialWidth: appStore.sidebar.width, disabled: () => busy.value });

watch(() => width.value, () => {
  appStore.sidebar.width=width.value;
  document.documentElement.style.setProperty('--sidebarWidth', width.value + 'px');
}, { immediate: true })

const changeActive = (active: "outliner" | "folder" | "search") => {
  appStore.sidebar.active = active;
}

const unexpand = () => {
  appStore.sidebar.visible = false;
}
</script>
<style lang="scss">
.layout-sidebar {
  font-family: var(--fontFamily);
  user-select: none;
  -webkit-user-select: none;
  flex-basis: var(--sidebarWidth, 220px);
  width:var(--sidebarWidth, 220px);
  height: 100vh;
  background-color: var(--primaryBackgroundColor);
  color: var(--primaryTextColor);
  padding-top: var(--titleBarHeight);
  box-sizing: border-box;
  display: flex;
  overflow: hidden;
  .sidebar-menu {
    flex-basis: 40px;
    min-width: 40px;
    position: relative;
    height: 100%;
    button { display: flex; width: 100%; align-items: center; justify-content: center; border: 0; padding: 6px 0; background: transparent; color: inherit; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: -2px; }

    .menu-item {
      padding: 4px 0;
      position: relative;
      cursor: pointer;
      &::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        width: 4px;
        height: 100%;
        transition: all .2s ease-in-out;
      }

      &.active {
        color: var(--primaryTextColorActive);

        &::before {
          background-color: var(--primaryTextColor);
        }
      }

      &:hover {
        // background: linear-gradient(to right,var(--primaryTextColorHover),var(--primaryBackgroundColor));
        color: var(--primaryTextColorHover);
      }

      span.i-icon {
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    .menu-bottom {
      position: absolute;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      bottom: 0;
      left: 0;
      padding: 6px 0;
      box-sizing: border-box;
      cursor: pointer;

      &:hover {
        color: var(--primaryTextColorHover);
      }
    }
  }

  .sidebar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    width: calc(var(--sidebarWidth, 220px) - 40px);
    height: calc(100vh - var(--titleBarHeight));
    > .marknote-outliner, > .folder-container, > .document-search { flex: 1; min-height: 0; }
  }
  .sidebar-width-error { flex: none; padding: 4px; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; button { color: inherit; border: 1px solid var(--primaryBorderColor); background: transparent; cursor: pointer; } }

}

.dragbar-resize {
  flex-basis: 0px;
  width: 0px;
  height: 100vh;
  cursor: col-resize;
  touch-action: none;

  &.resize-visible{
    flex-basis: var(--sidebarResizeWidth);
    width: var(--sidebarResizeWidth);
    &:hover, &.is-dragging, &:focus-visible {
      z-index: 1;
      background-color: var(--primaryTextColorActive, #4e86c7);
    }
  }
  &:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: -2px; }
}</style>
