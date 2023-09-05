<template>
  <Teleport to="body">
    <div class="marknote-menus" ref="menusRef" v-if="menuStore.visible">
      <div class="marknote-menu-mask" @click="onReset"></div>
      <div class="menus" :class="{'right-menu':platformName==='darwin'}">
        <div class="menu-item" :class="{split:item.split}" v-for="item in menus" :key="item.key">
          <div class="menu-content"  @click="onClick($event,item, 1)">
            <label class="menu-title">{{ item.label }}</label>
          </div>
          <div class="menus2" :class="{'right-menu':platformName==='darwin'}" v-if="key1 === item.key">
            <div class="menu-item" :class="{split:item2.split}" v-for="item2 in item.children" :key="item2.key">
              <div class="menu-content"  @click="onClick($event,item2, 2)">
                <label class="menu-checkbox">
                  <Check v-if="item2.checked"></Check>
                </label>
                <label class="menu-title">{{ item2.label }}</label>
                <span>{{ item2.shortcut }}</span>
              </div>
              <div class="menus3" :class="{'right-menu':platformName==='darwin'}" v-if="key2 === item2.key">
                <div class="menu-item"  :class="{split:item3.split}" v-for="item3 in item2.children" :key="item3.key">
                  <div class="menu-content" @click="onClick($event,item3, 3)">
                    <label class="menu-title">{{ item3.label }}</label>
                    <span>{{ item3.shortcut }}</span>
                  </div>

                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { ref,onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMenuStore } from '../../store/menu';
import {Check} from '@icon-park/vue-next';
import { platform } from '@tauri-apps/api/os';


const platformName = ref<'linux'| 'darwin'| 'ios'| 'freebsd'| 'dragonfly'| 'netbsd'| 'openbsd'| 'solaris'| 'android'| 'win32'>();


const menuStore = useMenuStore();
const menusRef=ref<HTMLElement>();
const { t } = useI18n();

const key1 = ref<string | null>(null);
const key2 = ref<string | null>(null);

onBeforeMount(async()=>{
  try{
    platformName.value=await platform();
    document.body.classList.add(platformName.value);
  }catch(e){
    console.error(e);
  }
});

interface Menu {
  label: string,
  type?: 'text' | 'checkbox'
  split?: boolean,
  key: string,
  shortcut?: string,
  checked?: boolean,
  children?: Menu[]
}

const menus = ref<Menu[]>([
  {
    label: t('file'),
    key: 'file',
    children: [
      {
        label: t('newTab'),
        key: 'newTab',
        type:'checkbox'
      },
      {
        label: t('newWindow'),
        key: 'newWindow',
        split: true
      },
      {
        label: t('openFile'),
        key: 'openFile',
      },
      {
        label: t('openFolder'),
        key: 'openFolder',
      },
      {
        label: t('openRecent'),
        key: 'openRecent',
        split: true
      },
      {
        label: t('save'),
        key: 'save',
      },
      {
        label: t('saveAs'),
        key: 'saveAs',
        split: true
      },
      {
        label: t('rename'),
        key: 'rename',
        split: true
      },
      {
        label: t('export'),
        key: 'export',
        split: true
      },
      {
        label: t('preferences'),
        key: 'preferences',
        split: true
      },
      {
        label: t('closeTab'),
        key: 'closeTab',
      },
      {
        label: t('closeWindow'),
        key: 'closeWindow',
        split: true
      },
      {
        label: t('quit'),
        key: 'quit',
      }
    ]
  },
  {
    label: t('edit'),
    key: 'edit',
    children:[
      {
        label:'撤销',
        key:'undo',
        shortcut:'Mod z'
      },
      {
        label:'重做',
        key:'redo',
        shortcut:'Mod y'
      }
    ]
  }
]);


const onClick = (e:MouseEvent,item:Menu, level:number) => {
  // console.log(item);
  if ((!item.children)||item.children.length===0) {
    menuStore.setKey(item);
    onReset();
  }

  const el=(e.target as HTMLElement);
  
  const top=el.offsetTop;
  menusRef.value?.style.setProperty(`--menu${level+1}Top`,top+'px');
  
  if (level === 1) {
    key1.value = item.key;
  } else if (level === 2) {
    if(item.type==='checkbox'){
      item.checked=!item.checked;
    }
    key2.value = item.key;
  } else {
    menuStore.setKey(item);
    onReset();
  }

}

const onReset=()=>{
  key1.value=null;
  key2.value=null;
  menuStore.visible = false;
}

</script>

<style lang="scss">
.marknote-menus {
  position: absolute;;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  --menu2Top:-4px;
  .marknote-menu-mask {
    width: 100%;
    height: 100%;
    z-index: 98;
    position: absolute;
  }

  .menus {
    font-size: 14px;
    top: 20px;
    left: var(--titleBarHeight);
    width: 100px;
    position: absolute;
    z-index: 99;
    background-color: var(--menuBackgroundColor, #fff);
    color: var(--menuColor,#202124);
    box-shadow: 2px 2px 13px var(--menuShadow,#b8b8b8);
    border-radius: 3px;

    &.right-menu{
      left: auto;
      right: var(--titleBarHeight);
    }

    .menu-item {
      user-select:none;
      .menu-content {
        padding: .2rem .6rem;

        &:hover {
          background-color: #e8e8e9;
        }
      }

      
      &.split{
        border-bottom: 1px solid var(--menuBorderColor,#dfdfdf);
      }
    }

    .menus2 {
      position: absolute;
      top: var(--menu2Top);
      left: 100px;
      width: 250px;
      margin-top: .4rem;
      background-color: var(--menuBackgroundColor, #fff);
      box-shadow: 2px 2px 13px #ccc;
      border-radius: 3px;
      &.right-menu{
        left: auto;
        right: 100px;
      }

      .menu-content {
        padding: .2rem .6rem;
        display: flex;

        &:hover {
          background-color: #e8e8e9;
        }
        


        &>label.menu-checkbox {
          width: 30px;
          input{
            visible:false;
            &:checked{
              visible:true;
            }
          }
          
        }

        &>label.menu-title {
          width: 100px;
        }

        &>span {
          flex: 1;
          text-align: right;
        }
      }
    }
  }
}</style>