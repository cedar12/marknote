<template>
  <el-dialog v-model="visible" :title="t('edit')+' KaTex'">
    <ElInput v-model="value" :autosize="{ minRows: 1, maxRows: 6 }" ref="inputRef" type="textarea"  @change="onChangeText"></ElInput>
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

appWindow.listen<string>('dialog-katex-visible',event=>{
    console.log(event);
    visible.value=true;
    value.value=event.payload;
});

const onChangeText=()=>{
  appWindow.emit('dialog-katex-text',value.value);
}


</script>