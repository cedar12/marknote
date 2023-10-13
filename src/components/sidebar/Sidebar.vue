<template>
  <div ref="sidebarRef" class="layout-sidebar" v-if="appStore.sidebar.visible" :style="`--sidebarWidth:${width}px`">

    <div class="sidebar-menu">
      <div class="menu-item" :class="{ 'active': appStore.sidebar.active === 'outliner' }" @click="changeActive('outliner')">
        <MindmapList  ></MindmapList>
      </div>
      <div class="menu-item" :class="{ 'active': appStore.sidebar.active === 'folder' }" @click="changeActive('folder')">
        <Notes  ></Notes>
      </div>
      <div class="menu-bottom" @click="unexpand">
        <ExpandRight  ></ExpandRight>
      </div>
    </div>
    <div class="sidebar-content">
      <Toc v-show="appStore.sidebar.active === 'outliner'"></Toc>
      <FolderView v-show="appStore.sidebar.active === 'folder'"></FolderView>
    </div>
  </div>
  <div class="dragbar-resize" ref="resizeRef"></div>
</template>
<script lang="ts" setup>
import { ref, watch } from 'vue';
import Toc from '../Toc.vue';
import FolderView from '../Folder.vue';
import { useAppStore } from '../../store/app';
import { Notes, MindmapList, ExpandRight } from '@icon-park/vue-next';
import { useDragSidebar } from './useDragSidebar';

const sidebarRef = ref<HTMLElement>();
const resizeRef = ref<HTMLElement>();
const appStore = useAppStore();

const { width } = useDragSidebar(resizeRef);

watch(() => width.value, () => {
  document.documentElement.style.setProperty('--sidebarWidth', width.value + 'px');
})

const changeActive = (active: "outliner" | "folder") => {
  appStore.sidebar.active = active;
}

const unexpand = () => {
  appStore.sidebar.visible = false;
}
</script>
<style lang="scss">
.layout-sidebar {
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
    width: calc(var(--sidebarWidth, 220px) - 40px);
    height: calc(100vh - var(--titleBarHeight));
  }

}

.dragbar-resize {
  flex-basis: 4px;
  width: 4px;
  height: 100vh;
  cursor: col-resize;

  &:hover {
    z-index: 99999;
    background-color: var(--primaryTextColorActive, #4e86c7);
  }
}</style>