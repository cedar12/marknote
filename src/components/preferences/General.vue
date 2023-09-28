<template>
  <div class="preferences-general">

    <div class="preferences-item" v-if="appStore.platform==='win32'">
      <div class="header">
        <span>文件关联</span>
      </div>
      <div class="content">
        <el-button size="default" @click="onClickFtype">关联默认打开</el-button>
      </div>
    </div>

    <div class="preferences-item">
      <div class="header">
        <span>{{ t('notice') }}</span>
      </div>
      <div class="content">
        <el-tag v-if="appStore.permissionGranted" type="success" effect="dark" >
          {{ t('granted') }}
        </el-tag>
        <el-tooltip  v-else
        effect="dark"
        :content="t('requestPermission')"
        placement="top-start"
      >
        <el-tag type="warning" effect="dark" @click="requestPermission">
          {{ t('ungranted') }}
        </el-tag>
      </el-tooltip>
        
      </div>
    </div>
    <div class="preferences-item">
      <div class="header">
        <span>{{ t('notSaveStatusBackground') }}</span>
      </div>
      <div class="content">
        <el-color-picker v-model="unsavedColor" @change="(value)=>onChange('unsavedColor',value)" />
      </div>
    </div>
    <div class="preferences-item">
      <div class="header">
        <span>{{ t('language') }}</span>
      </div>
      <div class="content">
        <ElSelect v-model="value" @change="(value)=>onChange('language',value)">
          <ElOption v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></ElOption>
        </ElSelect>
      </div>
    </div>
    
  </div>
</template>
<script lang="ts" setup>
import {ref,watch} from 'vue';
import {useAppStore} from '../../store/app';
import {useI18n} from 'vue-i18n';
import {ElSelect,ElOption,ElColorPicker,ElTag,ElTooltip,ElButton} from 'element-plus';
import { requestPermission } from '@tauri-apps/api/notification';
import {locales} from '../../i18n';
import { ftype } from '../../api/preferences';
// import { Command } from '@tauri-apps/api/shell';
// import { args } from '../../api/utils';

const appStore=useAppStore();
const {t,locale} = useI18n();

const value=ref(locale.value);
const unsavedColor=ref(localStorage.getItem('unsavedColor')||'rgb(66, 212, 21)');

watch(()=>locale.value,()=>{
  value.value=locale.value;
});

const options=locales();

const onChange=(event:string,value:any)=>{
  appStore.emit(event,value);
}

const onClickFtype=async ()=>{
  ftype();
  // const payload:string[]=await args();
  // new Command('ftype', [`Markdown=${payload[0]}`,'%1']);
}

</script>
<style lang="scss">
</style>