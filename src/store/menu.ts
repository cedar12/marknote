import { defineStore } from 'pinia'
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';
import { useEditorStore } from './editor';
import { useAppStore } from './app';
import { appWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/api/process';

export interface Menu {
  label: string,
  type?: 'text' | 'checkbox'
  split?: boolean,
  key: string,
  shortcut?: string,
  checked?: boolean,
  children?: Menu[]
}


interface MenuState {
  visible: boolean,
  key: string | null,
}

export const useMenuStore = defineStore('menu', {
  state: (): MenuState => ({
    visible: false,
    key: null,
  }),
  actions: {
    setKey(item: Menu) {
      this.key = item.key;
      if (item.key) {
        const event = (events as any)[item.key];
        if (event) {
          event(item);
        }
      }

    }
  }
})

const events = {
  newWindow() {
    invoke('open_window').then(() => console.log('set shadow')).catch(e => console.error(e));
  },
  closeWindow() {
    appWindow.close();
  },
  openFile() {
    open({
      multiple: false,
      filters: [{
        name: 'Markdown',
        extensions: ['md']
      }]
    }).then(async (selected) => {
      if (Array.isArray(selected)) {
        // user selected multiple files
      } else if (selected === null) {
        // user cancelled the selection
      } else {
        // user selected a single file
        // console.log(selected);
        const resp: any = await invoke('read_md', { path: selected });
        if (resp.code === 0) {
          const appStore = useAppStore();
          appStore.setFilepath(selected);
          const editorStore = useEditorStore();
          // editorStore.content = resp.data;
          editorStore.setContent(resp.data);
        }
        // console.log(resp);
      }
    }).catch(e => console.error(e));

  },
  save() {
    const editorStore = useEditorStore();
    const appStore = useAppStore();
    if (appStore.filepath) {
      invoke('save_md', { path: appStore.filepath, md: editorStore.getMarkdown() }).then((res:any) => { 
        console.log('save',res);
        if(res.code===0){
          appStore.isSave=true;
        }
      }).catch(e => console.error(e));
    }

  },
  preferences() {
    invoke('open_preferences');
  },
  alwaysOnTop(item:Menu){
    appWindow.setAlwaysOnTop(item.checked===true);
  },
  quit() {
    exit();
  }
}