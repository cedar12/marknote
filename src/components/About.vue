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
          <li class="main-info">{{name}} {{ version }}</li>
          
          <li style="margin-top: 10px;">Mode: {{env.MODE}}</li>
          <li>Platform: {{appStore.platform}}</li>
          <li>Arch: {{env.TAURI_ARCH}}</li>
          <li>Platform {{ t('version') }}: {{env.TAURI_PLATFORM_VERSION}}</li>
          <li>Tauri {{ t('version') }}: {{ tauriVersion }}</li>
          <li style="margin-top:10px;">{{ t('author') }}: <a href="mailto:cedar12.zxd@qq.com">cedar12.zxd@qq.com</a></li>
          <li>Source: <a href="https://github.com/cedar12/marknote" target="_blank">Github</a></li>
          <li>License: MIT</li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script lang=ts setup>
import {ref,watch,onBeforeMount} from 'vue';
import {useAppStore} from '../store/app';
import { getCurrent } from '@tauri-apps/api/window';
import { getName,getVersion,getTauriVersion } from '@tauri-apps/api/app';
// import { getName,getVersion,getTauriVersion } from '@tauri-apps/plugin-app';
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

const env=ref(import.meta.env);

const name=ref('MarkNote');
const version=ref('');
const tauriVersion=ref('');

console.log(env.value);

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
    user-select:none;
    --webkit-user-select:none;
    img{
      width: 80px;
      height: 80px;
    }
  }
  .about-info{
    flex: 1;
    font-size: 12px;
    ul{
      list-style: none;
      margin: 0;
      padding: 0;
      li{
        padding: 4px;
      }
    }
    .main-info{
      font-size: 16px;
      font-size: bold;
    }
  }
}
</style>