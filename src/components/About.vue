<template>
  <teleport to='#marknote-titlbar'>
    <div data-tauri-drag-region class="about-header">
        <div class="header-btn" v-if="appStore.platform!=='macos'" @click="appWindow.close()">
            <Close></Close>
        </div>
    </div>
  </teleport>
  <div class="about-container">
    <div class="about-row" style="margin-top: 10px;">
      <div class="about-logo">
        <img src="../assets/logo.png"/>
      </div>
      <div class="about-info">
        <ul>
          <li>{{t('version')}}: {{ version }}</li>
          <li>Tauri {{ t('version') }}: {{ tauriVersion }}</li>
          <li>{{ t('author') }}: <a href="mailto:cedar12.zxd@qq.com">cedar12</a></li>
        </ul>
      </div>
    </div>
    <div class="about-row" style="margin-top: 1em;">
      <div>Source: <a href="https://github.com/cedar12/marknote" target="_blank">Github</a></div>
    </div>
    <div class="about-row"  style="margin-top: 1em;">
      <div>License: MIT</div>
    </div>
  </div>
</template>
<script lang=ts setup>
import {ref,watch,onBeforeMount} from 'vue';
import {useAppStore} from '../store/app';
import { getCurrent } from '@tauri-apps/plugin-window';
import { getName,getVersion,getTauriVersion } from '@tauri-apps/plugin-app';
import {Close} from '@icon-park/vue-next';

const appWindow=getCurrent();

const appStore=useAppStore();
appStore.init();

import { useI18n } from 'vue-i18n';

const {t,locale} = useI18n();

appWindow.setTitle(t('about'));

watch(()=>locale.value,()=>{
    appWindow.setTitle(t('about'));
});

const name=ref('MarkNote');
const version=ref('');
const tauriVersion=ref('');

onBeforeMount(async ()=>{
  name.value=await getName();
  version.value=await getVersion();
  tauriVersion.value=await getTauriVersion();
})

</script>

<style lang="scss">
.about-header{
    --barHeight:var(--titleBarHeight,30px);
    height: var(--barHeight);
    display: flex;
    flex-direction: row-reverse;
    z-index: 990;
    .header-btn{
        width: var(--barHeight);
        height: var(--barHeight);
        text-align: center;
        line-height: var(--barHeight);
        &:hover{
          background: var(--contentTextColorHover,#dfdfdf);
        }
    }
}
.about-container{
  padding: 1em;
  font-size: 1em;
  .about-row{
    display: flex;
  }
  .about-logo{
    display: flex;
    justify-content: center;
    flex-basis: 90px;
    img{
      width: 80px;
      height: 80px;
    }
  }
  .about-info{
    flex: 1;
    ul{
      list-style: none;
      margin: 0;
      padding: 0;
      li{
        padding: 4px;
      }
    }
  }
}
</style>