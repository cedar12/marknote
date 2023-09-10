<template>
  <div class="preferences-language">
    <NSelect v-model:value="value" :options="options" :on-update:value="onChange">

    </NSelect>
    <!-- <select @change="onChange" v-model="locale">
      <option value="cn">中文</option>
      <option value="en">English</option>
    </select> -->
  </div>
</template>
<script lang="ts" setup>
import {ref,watch} from 'vue';
import {useAppStore} from '../../store/app';
import {useI18n} from 'vue-i18n';
import {NSelect} from 'naive-ui';

const appStore=useAppStore();
const {locale} = useI18n();

const value=ref(locale.value);

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

const onChange=(value:any)=>{
  // const value=e.target['value'];
  // locale.value=value;
  // localStorage.setItem("lang", value);
  console.log('change lang',value);
  appStore.emit('language',value);
}

</script>
<style lang="scss">
.preferences-language{

}
</style>