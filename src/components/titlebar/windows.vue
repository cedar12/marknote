<template>
  <div data-tauri-drag-region class="titlebar-bg"  :style="`--titlbarSidebarWidth: ${appStore.sidebar.visible?'var(--sidebarWidth)':'0'}`">
    <div data-tauri-drag-region class="titlebar">
      <div class="titlebar-toolbar">
        <div class="titlebar-tool" :class="{open:menuStore.visible,'sidebar-visbile':appStore.sidebar.visible}" @click="menuStore.visible=!menuStore.visible">
          <HamburgerButton theme="filled" />
        </div>
        <el-popover
          placement="bottom-start"
          :width="'auto'"
          :offset="-4"
          trigger="hover"
          popper-class="titlebar-words-popover"
          popper-style="min-width:auto;"
        >
          <template #reference>
            <div data-tauri-drag-region class="titlebar-words" >
              <span v-if="mode==='words'" data-tauri-drag-region>{{editorStore.editor?.storage.characterCount.words()}}</span>
              <span v-if="mode==='chars'" data-tauri-drag-region>{{editorStore.editor?.storage.characterCount.characters()}}</span>
              <span data-tauri-drag-region>{{ t(mode) }}</span>
            </div>
          </template>
          <div class="titlebar-words-wrapper" @contextmenu.prevent="">
            <div @click="mode='words'">{{ t('words') }}</div>
            <div @click="mode='chars'">{{ t('chars') }}</div>
          </div>
        </el-popover>
        
      </div>
      <div data-tauri-drag-region class="titlebar-info">
        <span data-tauri-drag-region class="marknote-title" :title="appStore.filepath||''">{{ appStore.title||'Untitled.md' }}</span>
        <span :class="{'not-save':appStore.isSave!==true}"></span>
      </div>
      <div class="titlebar-buttons">
        <div class="titlebar-button" @click="appWindow.minimize()">
          <Minus></Minus>
        </div>
        <div class="titlebar-button" @click="appWindow.toggleMaximize()">
          <Square theme="outline"/>
        </div>
        <div class="titlebar-button" @click="appStore.closeWindow()">
          <Close></Close>
        </div>
      </div>
    </div>
  </div >
  
</template>
<script lang="ts" setup>
import {ElPopover} from 'element-plus';
import {HamburgerButton,Close,Minus,Square} from '@icon-park/vue-next';
import { getCurrent } from '@tauri-apps/api/window'
import {useMenuStore} from '../../store/menu';
import {useAppStore} from '../../store/app';
import {useEditorStore} from '../../store/editor';
import {useI18n} from 'vue-i18n';
import {ref} from 'vue';

const appWindow=getCurrent();

const {t}=useI18n();
const menuStore=useMenuStore();
const appStore=useAppStore();
const editorStore=useEditorStore();

const mode=ref('words');

</script>

<style lang="scss">
//--titlebarBgHover --titleBarHeight --editorBgColor
.titlebar-bg{
  --titlebarBgHover:var(--primaryBackgroundColorHover);
  // --barHeight:var(--titleBarHeight,30px);
  height: var(--titleBarHeight);
  --titlbarSidebarWidth:var(--sidebarWidth,0);
  position: relative;
  left: 0;
  top: 0;
  right: 0;
  .titlebar{
    position:fixed;
    user-select: none;
    // background: transparent;
    background: linear-gradient(to right, var(--primaryBackgroundColor) 0, var(--primaryBackgroundColor) var(--titlbarSidebarWidth,0), var(--contentBackgroundColor,#ffffff) var(--titlbarSidebarWidth,0), var(--contentBackgroundColor,#ffffff) 100%) !important;
    height: var(--titleBarHeight);
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
      
      &>.titlebar-tool{
        height: var(--titleBarHeight);
        width: var(--titleBarHeight);
        line-height: var(--titleBarHeight);
        text-align: center;
        cursor: pointer;
        z-index: 4;
        
        transition: .4s ease-in-out;
        &.sidebar-visbile{
          color: var(--primaryTextColor);
        }
        &:hover{
          transform: rotate(90deg);
          
        }
        &.open{
          transform: rotate(90deg);
          // background: var(--titlebarBgHover,#dfdfdf);
        }
      }

      &>.titlebar-words{
        z-index: 3;
        cursor: pointer;
        position: absolute;
        height: var(--titleBarHeight);
        top: 0;
        left: calc(var(--titleBarHeight) + 12px);
        color: #a8a8a8;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 12px;
        &>span+span{
          margin-left: .4em;
        }
        // width: var(--titleBarHeight);
      }
      
    }

    .titlebar-info{
      width: 100%;//calc(100% - (var(--titleBarHeight) * 3 + 20px) * 2);
      height: var(--titleBarHeight);
      line-height:  var(--titleBarHeight);
      text-align:center;
      z-index: 2;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0 calc(var(--titleBarHeight) * 3 + 20px);

      span.marknote-title{
        mix-blend-mode: difference;
        color: rgba(255, 255, 255, 0.7);
        // &.not-save::after{
        //   content: '';
        //   display: inline-block;
        //   width: 10px;
        //   height: 10px;
        //   margin-left: 4px;
        //   background-color:var(--notSavedColor,rgb(66, 212, 21));
        //   border-radius: 50%;
        // }
        &+span.not-save{
          display: inline-block;
          width: 10px;
          height: 10px;
          margin-left: 4px;
          background-color:var(--notSavedColor,rgb(66, 212, 21));
          border-radius: 50%;
        }
      }
    }

    .titlebar-buttons{
      position:absolute;
      right:0;
      top:0;
      height: var(--titleBarHeight);
      width:calc(var(--titleBarHeight) * 3);
      display: flex;
      flex-direction: row;
      z-index: 3;
      .titlebar-button{
        display: inline-flex;
        justify-content: center;
        align-items: center;
        width: var(--titleBarHeight);
        height: var(--titleBarHeight);
        cursor: pointer;
        color: var(--contentTextColor);
        &:hover {
          background: var(--contentTextColorHover,#dfdfdf);
        }
      }
    }
  }
}
.titlebar-words-wrapper{
    &>div{
      cursor: pointer;
    }
  }
</style>