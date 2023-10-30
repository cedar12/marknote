<script setup lang="ts">
import Titlebar from './components/titlebar/index.vue';
import Layout from "./components/Layout.vue";
import Menu from "./components/menu/index.vue";
import {useAppStore} from './store/app';
import {computed} from 'vue';
import {createEditor} from './utils/editor';
createEditor();
const appStore=useAppStore();
appStore.init();

const key=computed(()=>{
  return appStore.recentFiles.join(',')+'_'+appStore.menuKey;
})

</script>

<template>
<div v-loading="appStore.loading">
    <Titlebar></Titlebar>
    <Layout></Layout>
    <Menu :key="key"></Menu>
</div>
  
</template>

<style scoped>
</style>
