<template>
  <teleport to='#marknote-titlbar'>
    <div data-tauri-drag-region class="about-header">
        <div class="header-btn" v-if="appStore.platform!=='darwin'" @click="appWindow.close()">
            <Close></Close>
        </div>
    </div>
  </teleport>
  <div class="about-container">
    <div class="about-logo">
      <img src="../assets/logo.png"/>
    </div>
    <div class="about-info">
      <ul>
        <li>{{ name }} Version: {{ version }}</li>
        <li>Tauri Version: {{ tauriVersion }}</li>
        <li>Author: <a href="mailto:cedar12.zxd@qq.com">cedar12</a></li>
        <li>Source: <a href="https://github.com/cedar12/marknote" target="_blank">Github</a></li>
        <li>License: MIT</li>
        
      </ul>
    </div>
  </div>
</template>
<script lang=ts setup>
import {ref,watch,onBeforeMount} from 'vue';
import {useAppStore} from '../store/app';
import { appWindow } from '@tauri-apps/api/window';
import { getName,getVersion,getTauriVersion } from '@tauri-apps/api/app';
import {Close} from '@icon-park/vue-next';

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
            background: var(--titlebarBgHover,#dfdfdf);
        }
    }
}
.about-container{
  padding: 1em;
  font-size: 14px;
  .about-logo{
    display: flex;
    justify-content: center;
    img{
      width: 80px;
    }
  }
}
</style>