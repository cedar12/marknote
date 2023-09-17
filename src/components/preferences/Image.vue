<template>
    <div class="preferences-image">
      <div class="preferences-item">
        <div class="header">
          <span>{{ t('image') }}</span>
        </div>
        <div class="content">
          <ElSelect v-model="saveType" @change="onChange">
            <ElOption v-for="item in options" :key="item.value" :label="item.label" :value="item.value"></ElOption>
          </ElSelect>
          <ElInput v-model="path" @change="onChangePath"></ElInput>

          <ElButton @click="onSave">保存</ElButton>
        </div>
        
      </div>
      
    </div>
  </template>
  <script lang="ts" setup>
  import {ref,onMounted} from 'vue';
  // import {useAppStore} from '../../store/app';
  import {useI18n} from 'vue-i18n';
  import {ElSelect,ElOption,ElInput,ElButton} from 'element-plus';
import { getConfig,save } from '../../api/preferences';
  
  // const appStore=useAppStore();
  const {t} = useI18n();
  
  const saveType=ref('default');

    
  const path=ref('');

  const options=[
    {
      label:'default',
      value:'default'
    },
    {
      label:'sepc',
      value:'sepc'
    },
    {
      label:'picgo',
      value:'picgo'
    }
  ];


  onMounted(async ()=>{
    const resp=await getConfig() as any;
    if(resp.code===0){
      saveType.value=resp.data.image_save_type||'default';
      path.value=resp.data.image_save_path||'default';
    }
  })
  
  const onChange=(value:any)=>{
    if(value==='picgo'&&path.value.trim()===''){
      path.value='http://127.0.0.1:36677/upload';
    }
  }

  const onChangePath=()=>{
    
  }

  const onSave=async ()=>{
    let reps= await save(saveType.value,path.value);
    console.log('save',reps);
  }
  
  </script>
  <style lang="scss">
  .preferences-image{
  
  }
  </style>