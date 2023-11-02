<template>
  <teleport to='#marknote-titlbar'>
    <mac v-if="appStore.platform==='macos'" @contextmenu.prevent=""/>
    <windows v-else @contextmenu.prevent=""/>
  </teleport>
</template>
<script lang="ts" setup>
import windows from './windows.vue';
import mac from './mac.vue';
import {useAppStore} from '../../store/app';

const appStore=useAppStore();

</script>