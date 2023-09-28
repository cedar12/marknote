<template>
  <div class="preferences-theme">
    <div class="preferences-item">
      <div class="header">
        <span>{{ t('theme') }}</span>
      </div>
      <div class="content">
        <div class="theme-item" :class="appStore.theme===theme.value?'active':''" v-for="theme in themes" @click="onChangeTheme(theme)">
          <div class="theme-option marknote" :key="theme.value" :style="caseStyle(theme.style)">
            <h3>{{ theme.label }}</h3>
            <p><a target="_blank" href="https://github.com/cedar12/marknote">MarkNote</a> is a simple <code class="inline">WYSIWYG</code> markdown editor</p>
            
          </div>
          <div class="active-icon">
            <FullSelection></FullSelection>
          </div>
        </div>
      </div>

    </div>
    <div class="preferences-item flat">
      <div class="header">
        <span>{{ t('autoTheme') }}</span>
      </div>
      <div class="content">
        <ElSwitch v-model="appStore.autoTheme" @change="onChange"></ElSwitch>
      </div>

    </div>
    

  </div>
</template>
<script lang="ts" setup>
// import { ref } from 'vue';
import {useAppStore} from '../../store/app';
import { useI18n } from 'vue-i18n';
import { ElSwitch } from 'element-plus';
import themes, { ThemeItem, ThemeStyle } from '../../theme';
import { emit } from '@tauri-apps/api/event';
import {FullSelection} from '@icon-park/vue-next';

const {t}=useI18n();
const appStore=useAppStore();
// const themeValue=ref<string>('light');

const caseStyle=(styles:ThemeStyle):string=>{
  var newStyle:string='';
  const keys=Object.keys(styles);
  for(let key of keys){
    newStyle+=`--${key}: ${(styles as any)[key]};`;
  }
  return newStyle;
}

const onChangeTheme=(theme:ThemeItem)=>{
  emit('theme',theme);
}

const onChange=()=>{
  localStorage.setItem('autoTheme',''+appStore.autoTheme);
}

</script>
<style lang="scss">
.preferences-theme{
  .theme-item{
    padding:1em 1em 0 1em;
    cursor: pointer;
    position: relative;
    box-sizing: border-box;
    &:last-child{
      padding-bottom: 1em;
    }
    .active-icon{
      display: none;
      position: absolute;
      top: calc(1em + 4px);
      left: calc(1em + 4px);
    }
    &.active{
      .active-icon{
        display: block;
      }

      &:hover{
        .theme-option{
          box-shadow: 0 0 24px rgba($color: #838383, $alpha: 0.7);
          transition: .4s ease-in;
        }
      }
      
    }
    .theme-option{
      border-radius: 4px;
      box-shadow: 0 0 14px rgba($color: #838383, $alpha: 0.7);
    }
  }
}
</style>