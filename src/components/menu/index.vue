<template>
  <Teleport to="body">
    <div class="marknote-menus" ref="menusRef" v-if="menuStore.visible">
      <div class="marknote-menu-mask" @click="onReset"  @contextmenu.prevent="onReset"></div>
      <div class="menus menus-level-1  glass" :class="{ 'right-menu': appStore.platform === 'macos' }" @contextmenu.prevent="">
        <div class="menu-item" :class="{ split: item.split }" v-for="item in menus" :key="item.key" >
          <div class="menu-content" :class="{ 'has-children': item.children && item.children.length > 0 }"
            @click="onClick($event, item, 1)"  v-if="item.platform==undefined||item.platform.includes(appStore.platform as any)">
            <label class="menu-title">{{ item.label }}</label>
            <i>
              <Right v-if="item.children && item.children.length > 0"></Right>
            </i>
          </div>
          <div class="menus menus-level-2  glass" :class="{ 'right-menu': appStore.platform === 'macos' }" v-if="key1 === item.key">
            
            <div class="menu-item" :class="{ split: item2.split }" v-for="item2 in item.children" :key="item2.key">
              <div class="menu-content" @click="onClick($event, item2, 2)" v-if="item2.platform==undefined||item2.platform.includes(appStore.platform as any)">
                <label class="menu-checkbox">
                  <Check v-if="item2.checked"></Check>
                </label>
                <label class="menu-title">{{ item2.label }}</label>
                <span>{{ replaceShortcut(item2.shortcut) }}</span>
                <i>
                  <Right v-if="item2.children && item2.children.length > 0"></Right>
                </i>
              </div>
              <div class="menus  menus-level-3  glass" :class="{ 'right-menu': appStore.platform === 'macos' }" v-if="key2 === item2.key">
                
                <div class="menu-item" :class="{ split: item3.split }" v-for="item3 in item2.children" :key="item3.key" >
                  <div class="menu-content" @click="onClick($event, item3, 3)" :title="item3.label"  v-if="item3.platform==undefined||item3.platform.includes(appStore.platform  as any)">
                    <label class="menu-title">{{ item3.label }}</label>
                    <span v-if="item3.shortcut">{{ replaceShortcut(item3.shortcut) }}</span>
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
          label: t('newFile'),
          key: 'newFile',
          shortcut:appStore.keyBinding?.getKey('file.newFile')?.key
        },
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
        // {
        //   label: t('rename'),
        //   key: 'rename',
        //   split: true
        // },
        {
          label: t(appStore.platform==='macos'?'openExplorerMacos':'openExplorerWindows'),
          key: 'openExplorer',
          platform: ['windows','macos'],
          split: true
        },
        // {
        //   label: t('import'),
        //   key: 'import',
        // },
        {
          label: t('export'),
          key: 'export',
          split: true,
          children: [
            {
              label: t('html'),
              key: 'html',
            },
            {
              label: t('image'),
              key: 'image',
            },
            {
              label: 'PDF',
              key: 'exportPdf',
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
        {
          label: t('closeFolder'),
          key: 'closeFolder',
        },
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
          label: t('cut'),
          key: 'cut',
          shortcut:appStore.keyBinding?.getKey('edit.cut')?.key,
        },
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
      label:t('format'),
      key: 'format',
      children:[
        {
          label: t('bold'),
          key: 'bold',
          shortcut:appStore.keyBinding?.getKey('format.bold')?.key,
        },
        {
          label: t('italic'),
          key: 'italic',
          shortcut:appStore.keyBinding?.getKey('format.italic')?.key,
        },
        {
          label: t('strikethrough'),
          key: 'strikethrough',
          shortcut:appStore.keyBinding?.getKey('format.strikethrough')?.key,
          split:true,
        },
        {
          label: t('inlineCode'),
          key: 'inlineCode',
          shortcut:appStore.keyBinding?.getKey('format.inlineCode')?.key,
        },
        {
          label: t('inlineMath'),
          key: 'inlineMath',
          split:true,
        },
        {
          label: t('clearFormat'),
          key: 'clearFormat',
        }
      ]
    },
    {
      label: t('paragraph'),
      key: 'paragraph',
      children: [
      {
          label: t('normalText'),
          key: 'normalText',
          shortcut:appStore.keyBinding?.getKey('paragraph.normalText')?.key,
        },
        {
          label: t('heading')+' 1',
          key: 'heading1',
          shortcut:appStore.keyBinding?.getKey('paragraph.heading1')?.key,
        },
        {
          label:  t('heading')+' 2',
          key: 'heading2',
          shortcut:appStore.keyBinding?.getKey('paragraph.heading2')?.key,
        },
        {
          label: t('heading')+' 3',
          key: 'heading3',
          shortcut:appStore.keyBinding?.getKey('paragraph.heading3')?.key,
        },
        {
          label: t('heading')+' 4',
          key: 'heading4',
          shortcut:appStore.keyBinding?.getKey('paragraph.heading4')?.key,
        },
        {
          label: t('heading')+' 5',
          key: 'heading5',
          shortcut:appStore.keyBinding?.getKey('paragraph.heading5')?.key,
        },
        {
          label: t('heading')+' 6',
          key: 'heading6',
          shortcut:appStore.keyBinding?.getKey('paragraph.heading6')?.key,
          split:true,
        },
        {
          label: t('table'),
          key: 'table',
          shortcut:appStore.keyBinding?.getKey('paragraph.table')?.key,
        },
        {
          label: t('codeFences'),
          key: 'codeFences',
          shortcut:appStore.keyBinding?.getKey('paragraph.codeFences')?.key,
        },
        {
          label: t('quoteBlock'),
          key: 'quoteBlock',
          shortcut:appStore.keyBinding?.getKey('paragraph.quoteBlock')?.key,
        },
        {
          label: t('mathBlock'),
          key: 'mathBlock',
          shortcut:appStore.keyBinding?.getKey('paragraph.mathBlock')?.key,
          split:true,
        },
        
        {
          label: t('orderedList'),
          key: 'orderedList',
          shortcut:appStore.keyBinding?.getKey('paragraph.orderedList')?.key,
        },
        {
          label: t('bulletList'),
          key: 'bulletList',
          shortcut:appStore.keyBinding?.getKey('paragraph.bulletList')?.key,
        },
        {
          label: t('taskList'),
          key: 'taskList',
          shortcut:appStore.keyBinding?.getKey('paragraph.taskList')?.key,
          split:true,
        },
        {
          label: t('paragraph'),
          key: 'paragraph',
          shortcut:appStore.keyBinding?.getKey('paragraph.paragraph')?.key,
        },
        {
          label: t('horizontalRule'),
          key: 'horizontalRule',
          shortcut:appStore.keyBinding?.getKey('paragraph.horizontalRule')?.key,
        },
      ]
    },

    {
      label: t('view'),
      key: 'view',
      children: [
        {
          label: t('sidebar'),
          key: 'sidebar',
          type:'checkbox',
          checked:appStore.sidebar.visible,
          shortcut:appStore.keyBinding?.getKey('view.sidebar')?.key,
        },
        // {
        //   label: t('folder'),
        //   key: 'folderView',
        //   type:'checkbox'
        // }
      ]
    },
    {
      label: t('help'),
      key: 'help',
      children: [
        {
          label: t('about'),
          key: 'about',
        },
        {
          label: t('checkUpdate'),
          key: 'checkUpdate',
        },
        {
          label: t('quickStart'),
          key: 'quickStart',
        }
      ]
    }

  ];

  nextTick(()=>{
    appStore.keyBinding?.on((bind)=>{
      // console.log('按下',bind);
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

watch(()=>appStore.sidebar.visible,()=>{
  loadMenuData();
})


function replaceShortcut(shortcut?:string){
  if(!shortcut)return '';
  const mod=appStore.platform==='macos'?'Cmd':'Ctrl';
  const alt=appStore.platform==='macos'?'Option':'Alt';
  const key=shortcut.replace(/Mod/g,mod).replace(/Alt/g,alt);
  // console.log('key->',key);
  return key;
}

</script>