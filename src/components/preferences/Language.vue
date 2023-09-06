<template>
  <div class="preferences-language">
    <select @change="onChange" v-model="locale">
      <option value="cn">中文</option>
      <option value="en">English</option>
    </select>
  </div>
</template>
<script lang="ts" setup>
// import {ref} from 'vue';
import {useAppStore} from '../../store/app';
import {useI18n} from 'vue-i18n';

const appStore=useAppStore();
const {locale} = useI18n();

const onChange=(e:any)=>{
  const value=e.target['value'];
  // locale.value=value;
  // localStorage.setItem("lang", value);
  appStore.emit('language',value);
}

</script>
<style lang="scss">
.preferences-language{

}
</style>