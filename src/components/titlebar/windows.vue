<template>
  <div data-tauri-drag-region class="titlebar-bg">
    <div data-tauri-drag-region class="titlebar">
      <div class="titlebar-toolbar">
        <div class="titlebar-tool" :class="{open:menuStore.visible}" @click="menuStore.visible=!menuStore.visible">
          <HamburgerButton theme="filled" />
        </div>
        
      </div>
      <div data-tauri-drag-region class="titlebar-info">
        <span data-tauri-drag-region class="marknote-title" :class="{'not-save':appStore.isSave!==true}" :title="appStore.filepath||''">{{ appStore.title||'marknote' }}</span>
      </div>
      <div class="titlebar-buttons">
        <div class="titlebar-button" @click="appWindow.minimize()">
          <Minus></Minus>
        </div>
        <div class="titlebar-button" @click="appWindow.toggleMaximize()">
          <Square theme="outline"/>
        </div>
        <div class="titlebar-button" @click="appWindow.close()">
          <Close></Close>
        </div>
      </div>
    </div>
  </div >
  
</template>
<script lang="ts" setup>
import {HamburgerButton,Close,Minus,Square} from '@icon-park/vue-next';
import { appWindow } from '@tauri-apps/api/window';
import {useMenuStore} from '../../store/menu';
import {useAppStore} from '../../store/app';


const menuStore=useMenuStore();
const appStore=useAppStore();

</script>

<style lang="scss">
//--titlebarBgHover --titleBarHeight --editorBgColor
.titlebar-bg{
  --barHeight:var(--titleBarHeight,30px);
  height: var(--barHeight);
  background: var(--editorBgColor,#ffffff);
  position: relative;
  left: 0;
  top: 0;
  right: 0;
  .titlebar{
    position:fixed;
    user-select: none;
    background: transparent;
    height: var(--barHeight);
    box-sizing: border-box;
    left: 0;
    top: 0;
    right: 0;
    z-index: 2;
    transition: color .4s ease-in-out;
    cursor: default;
    .titlebar-toolbar{
      position:absolute;
      left:0;
      top:0;
      height: var(--barHeight);
      width: var(--barHeight);
      &>.titlebar-tool{
        height: 100%;
        width: 100%;
        line-height: var(--barHeight);
        text-align: center;
        cursor: pointer;
        z-index: 3;
        transition: .4s ease-in-out;
        &:hover{
          transform: rotate(90deg);
          
        }
        &.open{
          transform: rotate(90deg);
          background: var(--titlebarBgHover,#dfdfdf);
        }
      }
      
    }

    .titlebar-info{
      width:100%;
      height: var(--barHeight);
      line-height:  var(--barHeight);
      text-align:center;
      z-index: 2;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0 calc(var(--barHeight) * 3);
      .marknote-title{
        &.not-save::after{
          content: ' *';

        }
      }
    }

    .titlebar-buttons{
      position:absolute;
      right:0;
      top:0;
      height: var(--barHeight);
      width:calc(var(--barHeight) * 3);
      display: flex;
      flex-direction: row;
      z-index: 3;
      .titlebar-button{
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: var(--barHeight);
        height: var(--barHeight);
        cursor: pointer;
        &:hover {
          background: var(--titlebarBgHover,#dfdfdf);
        }
      }
    }
  }
}
</style>