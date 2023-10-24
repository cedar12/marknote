<template>
  <el-dialog v-model="visible" :title="t('edit')+' Link'">
    <ElInput v-model="value" @change="onChange"></ElInput>
  </el-dialog>

</template>
<script lang="ts" setup>
import {ElDialog,ElInput} from 'element-plus';
import {ref} from 'vue';
import { getCurrent } from '@tauri-apps/api/window';
import {useI18n} from 'vue-i18n';
const appWindow=getCurrent();
const {t}=useI18n();
const visible=ref(false);
const value=ref<string|null>(null);
const from=ref<number>();
const to=ref<number>();

appWindow.listen<{href:string,from:number,to:number}>('dialog-link-visible',event=>{
    console.log(event);
    visible.value=true;
    value.value=event.payload.href;
    from.value=event.payload.from;
    to.value=event.payload.to;
});

const onChange=()=>{
  appWindow.emit('dialog-link-value',{href:value.value,from:from.value,to:to.value});
}


</script>