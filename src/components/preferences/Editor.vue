<template>
  <div class="preferences-markdown">
    <div class="preferences-item">
      <div class="header">
        <span>{{ t('codeTheme') }}</span>
      </div>
      <div class="content">
        <ElSelect v-model="editorStore.codeTheme" @change="onChange">
          <ElOption v-for="item in options" :key="item" :label="item" :value="item"></ElOption>
        </ElSelect>
      </div>
    </div>
    
  </div>
</template>
<script lang="ts" setup>
import {useAppStore} from '../../store/app';
import {useEditorStore} from '../../store/editor2';
import {useI18n} from 'vue-i18n';
import {ElSelect,ElOption} from 'element-plus';

const appStore=useAppStore();

const editorStore=useEditorStore();
const {t} = useI18n();

const options=['default','github','github-dark','idea','intellij-light','vs','xcode','googlecode','atom-one-dark','atom-one-light','codepen-embed','nnfx-dark','nnfx-light'];

const onChange=(value:any)=>{
  // const value=e.target['value'];
  // locale.value=value;
  // localStorage.setItem("lang", value);
  console.log('change lang',value);
  appStore.emit('codeTheme',value);
}
</script>
<style lang="scss">
.preferences-markdown{
}
</style>