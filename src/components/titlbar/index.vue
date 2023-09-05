<template>
  <teleport to='#marknote-titlbar'>
    <mac v-if="platformName==='darwin'"/>
    <windows v-else/>
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
  }catch(e){
    console.error(e);
  }
});

</script>