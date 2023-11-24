<template>
  <div class="preferences-markdown">
    <div class="preferences-item">
      <div class="header flex">
        <span>{{ t('codeTheme') }}</span>
      </div>
      <div class="content">
        <ElSelect v-model="editorStore.codeTheme" @change="onChange">
          <ElOption v-for="item in options" :key="item" :label="item" :value="item"></ElOption>
        </ElSelect>
      </div>
    </div>
    <div class="preferences-item">
      <div class="header">
        <span>{{t('tabSize')}}</span>
      </div>
      <div class="content">
        <ElSelect v-model="preferencesStore.editor.tabSize" @change="onChangeTabSize">
          <ElOption label="2" :value="2"></ElOption>
          <ElOption label="4" :value="4"></ElOption>
        </ElSelect>
      </div>
    </div>
    
  </div>
</template>
<script lang="ts" setup>
import {useAppStore} from '../../store/app';
import {useEditorStore} from '../../store/editor';
import {usePreferencesStore} from '../../store/preferences';
import {useI18n} from 'vue-i18n';
import {ElSelect,ElOption} from 'element-plus';

const appStore=useAppStore();
const preferencesStore=usePreferencesStore();

const editorStore=useEditorStore();
const {t} = useI18n();

const options=['github','github-dark','idea','intellij-light','vs','xcode','googlecode','atom-one-dark','atom-one-light','codepen-embed','nnfx-dark','nnfx-light'];

const onChange=(value:any)=>{
  // const value=e.target['value'];
  // locale.value=value;
  // localStorage.setItem("lang", value);
  // console.log('change lang',value);
  localStorage.setItem('codeTheme',value);
  appStore.emit('codeTheme',value);
}

const onChangeTabSize=()=>{
  appStore.emit('tabSize',preferencesStore.editor.tabSize);
}
</script>
<style lang="scss">
.preferences-markdown{
}
</style>