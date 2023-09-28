<template>
  <el-dialog v-model="visible" :title="t('edit')+' Link'">
    <ElInput v-model="value" @change="onChange"></ElInput>
  </el-dialog>

</template>
<script lang="ts" setup>
import {ElDialog,ElInput} from 'element-plus';
import {ref} from 'vue';
import {appWindow} from '@tauri-apps/api/window';
import {useI18n} from 'vue-i18n';
const {t}=useI18n();
const visible=ref(false);
const value=ref<string|null>(null);

appWindow.listen<string>('dialog-link-visible',event=>{
    console.log(event);
    visible.value=true;
    value.value=event.payload;
});

const onChange=()=>{
  appWindow.emit('dialog-link-value',value.value);
}


</script>