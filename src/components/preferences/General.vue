<template>
  <div class="preferences-general">
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
import {ElSelect,ElOption,ElColorPicker} from 'element-plus';

const appStore=useAppStore();
const {t,locale} = useI18n();

const value=ref(locale.value);
const unsavedColor=ref(localStorage.getItem('unsavedColor')||'rgb(66, 212, 21)');

watch(()=>locale.value,()=>{
  value.value=locale.value;
});

const options=[
  {
    label:'中文',
    value:'cn'
  },
  {
    label:'English',
    value:'en'
  }
];

const onChange=(event:string,value:any)=>{
  appStore.emit(event,value);
}

</script>
<style lang="scss">
.preferences-language{

}
</style>