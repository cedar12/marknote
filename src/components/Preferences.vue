<template>
    <teleport to='#marknote-titlbar'>
        <div data-tauri-drag-region class="preferences-header">
            <div class="header-btn" v-if="appStore.platform!=='darwin'" @click="appWindow.close()">
                <Close></Close>
            </div>
        </div>
    </teleport>
    <div class="marknote-preferences">
        <div class="preferences">
            <div class="left">
                <div class="preferences-content">
                    <div class="window-title">{{ t('preferences') }}</div>
                    <div class="preferences-router">
                        <div class="router-item">
                            <span>{{ t('language') }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="right">
                <div class="preferences-content">
                    <div style="padding: 0 1rem;">
                        <Language v-if="key==='language'"></Language>
                    </div>
                    
                </div>
            </div>
        </div>
        
    </div>
</template>
<script lang="ts" setup>
import {ref,watch} from 'vue';
import {Close} from '@icon-park/vue-next';
import {useAppStore} from '../store/app';
import { appWindow } from '@tauri-apps/api/window';
import Language from './preferences/Language.vue';

const appStore=useAppStore();
appStore.init();
import { useI18n } from 'vue-i18n';

const key=ref<string>('language');

const {t,locale} = useI18n();

appWindow.setTitle(t('preferences'));

watch(()=>locale.value,()=>{
    appWindow.setTitle(t('preferences'));
})
</script>
<style lang="scss">
.preferences-header{
    --barHeight:var(--titleBarHeight,30px);
    height: var(--barHeight);
    display: flex;
    flex-direction: row-reverse;
    z-index: 990;
    .header-btn{
        width: var(--barHeight);
        height: var(--barHeight);
        text-align: center;
        line-height: var(--barHeight);
        &:hover{
            background: var(--titlebarBgHover,#dfdfdf);
        }
    }
}
.marknote-preferences{
    width: 100vw;
    height: 100vh;
    .preferences{
        position: relative;
        top: calc(0px - var(--titleBarHeight));
        padding-top: var(--titleBarHeight);
        overflow: auto;
        display: flex;
        width: 100vw;
        height: 100vh;
        &>.left{
            flex-basis: 200px;
            background-color: var(--primaryBackgroundColor);
            padding-top: var(--titleBarHeight);
            color: var(--primaryTextColor);
        }
        &>.right{
            flex: 1;
            padding-top: var(--titleBarHeight);
        }
        .preferences-content{
            height: calc(100vh - var(--titleBarHeight));
            overflow: auto;

            .window-title{
                font-size: 1.4rem;
                text-align: center;
            }
            .preferences-router{
                padding-top: 1rem;
                .router-item{
                    padding: 0.5rem 1rem;
                    font-size: 1.4rem;
                    position: relative;
                    &:hover{
                        background-color: var(--primaryBackgroundColorHover);
                        background-image: linear-gradient(to right,var(--primaryBackgroundColor),var(--primaryBackgroundColorActive));
                        color: var(--primaryTextColorHover);
                        &::before{
                            content: '';
                            position: absolute;
                            width: 2px;
                            height: 100%;
                            left: 0;
                            top: 0;
                            border-left: 4px solid var(--primaryBorderColor);
                        }
                    }
                    &.active{
                        background-color: var(--primaryBackgroundColorActive);
                        color: var(--primaryTextColorActive);
                        &::before{
                            content: '';
                            position: absolute;
                            width: 2px;
                            height: 100%;
                            left: 0;
                            top: 0;
                            border-left: 4px solid var(--primaryBorderColor);
                        }
                    }
                }
            }
        }
    }
    
}


</style>