<template>
    <teleport to='#marknote-titlbar'>
        <div data-tauri-drag-region class="preferences-header">
            <div class="header-btn" v-if="appStore.platform!=='macos'" @click="appWindow.close()">
                <Close></Close>
            </div>
        </div>
    </teleport>
    <ElConfigProvider :locale="elLocale">
        <div class="marknote-preferences">
            <div class="preferences">
                <div class="left">
                    <div class="preferences-content">
                        <div class="window-title">{{ t('preferences') }}</div>
                        <div class="preferences-router">
                            <div v-for="item in options" :key="item" class="router-item" :class="{active:key===item}" @click="handleClick(item)">
                                <span>{{ t(item) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="right">
                    <div class="preferences-content">
                        <div style="padding: 0 1rem;">
                            <General v-if="key==='general'"></General>
                            <Editor v-if="key==='editor'"></Editor>
                            <Image v-if="key==='image'"></Image>
                            <Theme v-if="key==='theme'"></Theme>
                        </div>
                        
                    </div>
                </div>
            </div>
            
        </div>
    </ElConfigProvider>
</template>
<script lang="ts" setup>
import {ref,watch} from 'vue';
import {Close} from '@icon-park/vue-next';
import {useAppStore} from '../store/app';
import { getCurrent } from '@tauri-apps/api/window';
import General from './preferences/General.vue';
import Editor from './preferences/Editor.vue';
import Image from './preferences/Image.vue';
import Theme from './preferences/Theme.vue';
import { ElConfigProvider } from 'element-plus';
import * as elementPlusLocales from 'element-plus/es/locale/index';

const appWindow=getCurrent();

const appStore=useAppStore();
appStore.init();
import { useI18n } from 'vue-i18n';

const key=ref<string>('general');

const {t,locale} = useI18n();

const elLocale=ref((elementPlusLocales as any)[locale.value]);

const options=['general','editor','markdown','theme','image'];

appWindow.setTitle(t('preferences'));

watch(()=>locale.value,()=>{
    elLocale.value=(elementPlusLocales as any)[locale.value];
    appWindow.setTitle(t('preferences'));
});

const handleClick=(k:string)=>{
    key.value=k;
}
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
            background: var(--contentTextColorHover,#dfdfdf);
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
                    font-size: 16px;
                    position: relative;
                    cursor: pointer;
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

            .preferences-item{
                &.right{
                    text-align: right;
                }
                &.flat{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.4em;
                    &>.header{
                        padding: 0;
                        border-bottom: none;
                    }
                }
                &>.header{
                    padding: 0.4em;
                    border-bottom: 1px dashed #ccc;
                }
                &>.content{
                    padding: 0.4em;
                    .el-select{
                        width: 100%;
                    }
                    .content-tip{
                        color: var(--contentBorderColor);
                        padding: 1em 0;
                    }
                }
            }

        }
    }
    
}


</style>