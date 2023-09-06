<script setup lang="ts">
import Titlebar from './components/titlebar/index.vue';
import Layout from "./components/Layout.vue";
import Menu from "./components/menu/index.vue";
import {useAppStore} from './store/app';
const appStore=useAppStore();
appStore.init();

</script>

<template>
  <Titlebar></Titlebar>
  <Layout></Layout>
  <Menu></Menu>
</template>

<style scoped>
</style>
