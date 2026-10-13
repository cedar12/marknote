<script setup lang="ts">
import Titlebar from './components/titlebar/index.vue';
import Layout from "./components/Layout.vue";
import Menu from "./components/menu/index.vue";
import {useAppStore} from './store/app';
import {computed, onMounted, onBeforeUnmount} from 'vue';
import { useDraftsStore } from './store/drafts';
import DraftRecoveryDialog from './components/dialog/DraftRecoveryDialog.vue';
import { useFileComparisonStore } from './store/fileComparison';
import { useDocumentSearchStore } from './store/documentSearch';
const appStore=useAppStore();
appStore.init();
const drafts = useDraftsStore();
const comparison=useFileComparisonStore();
const search=useDocumentSearchStore();
onMounted(() => { void drafts.init(); });
onBeforeUnmount(() => drafts.dispose());

const key=computed(()=>{
  return appStore.recentFiles.join(',')+'_'+appStore.menuKey;
})

</script>

<template>
<div :inert="drafts.visible || comparison.visible || Boolean(search.replacementPreview) || appStore.lifecycleBusy">
    <Titlebar></Titlebar>
    <Layout></Layout>
    <Menu :key="key"></Menu>
</div>
<DraftRecoveryDialog />
  
</template>

<style scoped>
</style>
