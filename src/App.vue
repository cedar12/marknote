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

document.oncontextmenu = function (event: any) {
    if (window.event) {
        event = window.event
    }
    try {
        var the = event.srcElement
        if (
            !(
                (the.tagName == 'INPUT' && the.type.toLowerCase() == 'text') ||
                the.tagName == 'TEXTAREA'
            )
        ) {
            return false
        }
        return true
    } catch (e) {
        return false
    }
}

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
