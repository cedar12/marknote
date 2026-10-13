<template>
  <div class="preferences-general">

    <!-- <div class="preferences-item" v-if="appStore.platform==='win32'">
      <div class="header">
        <span>文件关联</span>
      </div>
      <div class="content">
        <el-button size="default" @click="onClickFtype">关联默认打开</el-button>
      </div>
    </div> -->

    <div class="preferences-item">
      <div class="header">
        <span>{{ t('notice') }}</span>
      </div>
      <div class="content">
        <el-tag v-if="appStore.permissionGranted" type="success" effect="dark" >
          {{ t('granted') }}
        </el-tag>
        <template v-else>
          <ElTag type="warning">{{ t('ungranted') }}</ElTag>
          <ElButton :disabled="requestingPermission" :loading="requestingPermission" @click="requestNotificationPermission">{{ t('requestPermission') }}</ElButton>
        </template>
        <p v-if="permissionFailed" role="alert">{{ t('notificationPermissionFailed') }}</p>
      </div>
    </div>
    <div class="preferences-item">
      <div class="header">
        <label for="general-unsaved-color">{{ t('notSaveStatusBackground') }}</label>
      </div>
      <div class="content">
        <ElColorPicker id="general-unsaved-color" v-model="unsavedColor" v-control-a11y="{ id: 'general-unsaved-color', label: t('notSaveStatusBackground') }" @change="(value)=>onChange('unsavedColor',value)" />
      </div>
    </div>
    <div class="preferences-item">
      <div class="header">
        <label for="general-language">{{ t('language') }}</label>
      </div>
      <div class="content">
        <ElSelect id="general-language" v-model="value" v-control-a11y="{ id: 'general-language', label: t('language') }" @change="(value)=>onChange('language',value)">
          <ElOption v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></ElOption>
        </ElSelect>
      </div>
    </div>

    <div class="preferences-item flat">
      <div class="header">
        <label for="general-auto-save">{{ t('autoSave') }}</label>
      </div>
      <div class="content">
        <ElSwitch id="general-auto-save" v-model="appStore.autoSave" v-control-a11y="{ id: 'general-auto-save', label: t('autoSave') }" @change="(value)=>onChange('autoSave',value)"></ElSwitch>
      </div>

    </div>
    
  </div>
</template>
<script lang="ts" setup>
import {ref,watch} from 'vue';
import {useAppStore} from '../../store/app';
import {useI18n} from 'vue-i18n';
import {ElSelect,ElOption,ElColorPicker,ElTag,ElButton,ElSwitch} from 'element-plus';
import { requestPermission as askNotificationPermission } from '@tauri-apps/plugin-notification';
import { vControlA11y } from '../../directives/controlA11y';
import {locales} from '../../i18n';
// import { ftype } from '../../api/preferences';
// import { Command } from '@tauri-apps/api/shell';
// import { args } from '../../api/utils';

const appStore=useAppStore();
const {t,locale} = useI18n();

const value=ref(locale.value);
const requestingPermission = ref(false);
const permissionFailed = ref(false);
const unsavedColor=ref(localStorage.getItem('unsavedColor')||'rgb(66, 212, 21)');

watch(()=>locale.value,()=>{
  value.value=locale.value;
});

const options=locales();

const onChange=(event:string,value:any)=>{
  appStore.emit(event,value);
}

async function requestNotificationPermission() {
  if (requestingPermission.value) return;
  requestingPermission.value = true;
  permissionFailed.value = false;
  try { appStore.permissionGranted = await askNotificationPermission() === 'granted'; }
  catch { permissionFailed.value = true; }
  finally { requestingPermission.value = false; }
}

// const onClickFtype=async ()=>{
//   ftype();
//   // const payload:string[]=await args();
//   // new Command('ftype', [`Markdown=${payload[0]}`,'%1']);
// }

</script>
<style lang="scss">
.preferences-general label { cursor: pointer; }
.preferences-general { font-family: var(--fontFamily); }
.preferences-general .el-button { margin-left: 8px; }
.preferences-general .el-button:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
</style>
