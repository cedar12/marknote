<template>
  <Teleport to="body">
    <div class="marknote-menus" ref="menusRef" v-if="menuStore.visible">
      <div class="marknote-menu-mask" @click="onReset"></div>
      <div class="menus" :class="{ 'right-menu': platformName === 'darwin' }">
        <div class="menu-item" :class="{ split: item.split }" v-for="item in menus" :key="item.key">
          <div class="menu-content" :class="{ 'has-children': item.children && item.children.length > 0 }"
            @click="onClick($event, item, 1)">
            <label class="menu-title">{{ item.label }}</label>
            <i>
              <Right v-if="item.children && item.children.length > 0"></Right>
            </i>
          </div>
          <div class="menus2" :class="{ 'right-menu': platformName === 'darwin' }" v-if="key1 === item.key">
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
              <div class="menus3" :class="{ 'right-menu': platformName === 'darwin' }" v-if="key2 === item2.key">
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
import { ref, onBeforeMount,watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, useMenuStore } from '../../store/menu';
import { Check, Right } from '@icon-park/vue-next';
import { platform } from '@tauri-apps/api/os';
import '../../scss/menu.scss';

const platformName = ref<'linux' | 'darwin' | 'ios' | 'freebsd' | 'dragonfly' | 'netbsd' | 'openbsd' | 'solaris' | 'android' | 'win32'>();


const menuStore = useMenuStore();
const menusRef = ref<HTMLElement>();
const { t, locale } = useI18n();


const key1 = ref<string | null>(null);
const key2 = ref<string | null>(null);



onBeforeMount(async () => {
  try {
    platformName.value = await platform();
    document.body.classList.add(platformName.value);
  } catch (e) {
    console.error(e);
  }
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
      children: [
        {
          label: '撤销',
          key: 'undo',
          shortcut: 'Mod z'
        },
        {
          label: '重做',
          key: 'redo',
          shortcut: 'Mod y'
        }
      ]
    },
    {
      label: t('view'),
      key: 'view',
      children: [
        {
          label: '大纲',
          key: 'outliner',
          type:'checkbox'
        },
        {
          label: '文件夹',
          key: 'olderView',
          type:'checkbox'
        }
      ]
    }
  ];
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