<template>
  <teleport to='#marknote-titlbar'>
    <mac v-if="platformName==='darwin'" @contextmenu.prevent=""/>
    <windows v-else @contextmenu.prevent=""/>
  </teleport>
</template>
<script lang="ts" setup>
import {ref,onBeforeMount} from 'vue';
import windows from './windows.vue';
import mac from './mac.vue';
import { platform } from '@tauri-apps/api/os';


const platformName = ref<'linux'| 'darwin'| 'ios'| 'freebsd'| 'dragonfly'| 'netbsd'| 'openbsd'| 'solaris'| 'android'| 'win32'>();
onBeforeMount(async()=>{
  try{
    platformName.value=await platform();
    document.body.classList.add(platformName.value);
  }catch(e){
    console.error(e);
  }
});

</script>