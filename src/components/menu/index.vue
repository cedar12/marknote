<template>
  <Teleport to="body">
    <div class="marknote-menus" ref="menusRef" v-if="menuStore.visible">
      <div class="marknote-menu-mask" @click="onReset"  @contextmenu.prevent="onReset"></div>
      <div class="menus menus-level-1  glass" :class="{ 'right-menu': appStore.platform === 'darwin' }" @contextmenu.prevent="">
        <div class="menu-item" :class="{ split: item.split }" v-for="item in menus" :key="item.key">
          <div class="menu-content" :class="{ 'has-children': item.children && item.children.length > 0 }"
            @click="onClick($event, item, 1)">
            <label class="menu-title">{{ item.label }}</label>
            <i>
              <Right v-if="item.children && item.children.length > 0"></Right>
            </i>
          </div>
          <div class="menus menus-level-2  glass" :class="{ 'right-menu': appStore.platform === 'darwin' }" v-if="key1 === item.key">
            <div class="menu-item" :class="{ split: item2.split }" v-for="item2 in item.children" :key="item2.key">
              <div class="menu-content" @click="onClick($event, item2, 2)">
                <label class="menu-checkbox">
                  <Check v-if="item2.checked"></Check>
                </label>
                <label class="menu-title">{{ item2.label }}</label>
                <span>{{ item2.shortcut }}</span>
                <i>
                  <Right v-if="item2.children && item2.children.length > 0"></Right>
                </i>
              </div>
              <div class="menus  menus-level-3  glass" :class="{ 'right-menu': appStore.platform === 'darwin' }" v-if="key2 === item2.key">
                <div class="menu-item" :class="{ split: item3.split }" v-for="item3 in item2.children" :key="item3.key">
                  <div class="menu-content" @click="onClick($event, item3, 3)">
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
import { ref, onBeforeMount,watch,nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, useMenuStore } from '../../store/menu';
import {useAppStore} from '../../store/app';
import { Check, Right } from '@icon-park/vue-next';
import '../../scss/menu.scss';


const appStore=useAppStore();
const menuStore = useMenuStore();
const menusRef = ref<HTMLElement>();
const { t, locale } = useI18n();


const key1 = ref<string | null>(null);
const key2 = ref<string | null>(null);

onBeforeMount(async () => {
  loadMenuData();
});

const menus = ref<Menu[]>([]);

const loadMenuData=()=>{
  menus.value = [
    {
      label: t('file'),
      key: 'file',
      children: [
        // {
        //   label: t('newTab'),
        //   key: 'newTab',
        //   type: 'checkbox'
        // },
        {
          label: t('newWindow'),
          key: 'newWindow',
          split: true,
          shortcut:appStore.keyBinding?.getKey('file.newWindow')?.key
        },
        {
          label: t('openFile'),
          key: 'openFile',
          shortcut:appStore.keyBinding?.getKey('file.openFile')?.key
        },
        {
          label: t('openFolder'),
          key: 'openFolder',
        },
        {
          label: t('openRecent'),
          key: 'openRecent',
          split: true,
          children:[
            {
              label:t('clearRecent'),
              key:'clearRecent',
              split:true,
            },
            ...appStore.recentFiles.map((r:string)=>({label:r,key:'recent_'+r})),

          ]
        },
        {
          label: t('save'),
          key: 'save',
          shortcut:appStore.keyBinding?.getKey('file.save')?.key
        },
        {
          label: t('saveAs'),
          key: 'saveAs',
          shortcut:appStore.keyBinding?.getKey('file.saveAs')?.key,
          split: true
        },
        {
          label: t('rename'),
          key: 'rename',
          split: true
        },
        {
          label: t('import'),
          key: 'import',
        },
        {
          label: t('export'),
          key: 'export',
          split: true,
          children: [
            {
              label: 'HTML',
              key: 'html',
            }
          ]
        },
        {
          label: t('preferences'),
          key: 'preferences',
          shortcut:appStore.keyBinding?.getKey('file.preferences')?.key,
          split: true
        },
        {
          label: t('alwaysOnTop'),
          key: 'alwaysOnTop',
          split: true,
          type:'checkbox'
        },
        // {
        //   label: t('closeTab'),
        //   key: 'closeTab',
        // },
        {
          label: t('closeWindow'),
          key: 'closeWindow',
          shortcut:appStore.keyBinding?.getKey('file.closeWindow')?.key,
          split: true
        },
        {
          label: t('quit'),
          key: 'quit',
          shortcut:appStore.keyBinding?.getKey('file.quit')?.key,
        }
      ]
    },
    {
      label: t('edit'),
      key: 'edit',
      children: [
        {
          label: t('undo'),
          key: 'undo',
          shortcut:appStore.keyBinding?.getKey('edit.undo')?.key,
        },
        {
          label: t('redo'),
          key: 'redo',
          shortcut:appStore.keyBinding?.getKey('edit.redo')?.key,
        }
      ]
    },
    {
      label: t('view'),
      key: 'view',
      children: [
        {
          label: t('outliner'),
          key: 'outliner',
          type:'checkbox',
          checked:appStore.visible.outliner,
        },
        {
          label: t('folder'),
          key: 'folderView',
          type:'checkbox'
        }
      ]
    }
  ];

  nextTick(()=>{
    appStore.keyBinding?.on((bind)=>{
      console.log('按下',bind);
      var temp=menus.value;
      for (let i = 0; i < bind.description.length-1; i++) {
        const b = bind.description[i];
        var item=temp.find(t=>t.key===b);
        if(item&&item.children){
          temp=item.children;
        }
      }
      const menu=temp.find(t=>t.key===bind.description[bind.description.length-1]);
      if(menu&&((!menu.children) || menu.children.length === 0)){
        if (menu.type === 'checkbox') {
           menu.checked = !menu.checked;
        }
        menuStore.setKey(menu);
        onReset();
        return true;
      }
    })
  });
  

}

const onClick = (e: MouseEvent, item: Menu, level: number) => {
  // console.log(item);
  const el = (e.target as HTMLElement);

  const top = el.offsetTop;
  menusRef.value?.style.setProperty(`--menu${level + 1}Top`, top + 'px');

  if (level === 1) {
    key1.value = item.key;
  } else if (level === 2) {
    if (item.type === 'checkbox') {
      item.checked = !item.checked;
    }
    key2.value = item.key;
  }
  if ((!item.children) || item.children.length === 0) {
    menuStore.setKey(item);
    onReset();
  }
}

const onReset = () => {
  key1.value = null;
  key2.value = null;
  menuStore.visible = false;
}

watch(()=>locale.value,()=>{
  loadMenuData();
})

</script>