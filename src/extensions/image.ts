import { Image as BuiltInImage } from '@tiptap/extension-image';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import ImageWrapper from './wrapper/ImageWrapper.vue';
import { Plugin, PluginKey, SelectionBookmark } from 'prosemirror-state';
import { saveImage } from '../api/file';
import {useAppStore} from '../store/app';
import { useEditorStore } from '../store/editor';
import * as appLog from '@tauri-apps/plugin-log';
import { message } from '@tauri-apps/plugin-dialog';
import i18n from '../i18n';

// @ts-ignore
const resolveImageEl = (element:HTMLElement):HTMLImageElement => (element.nodeName === 'IMG' ? element : element.querySelector('img'));

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    iamge: {
      setEmptyImage: (arg: { width?: number | string }) => ReturnType;
    };
  }
}

export const Image = BuiltInImage.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      content: '',
      marks: '',
      group: 'block',
      draggable: true,
      selectable: true,
      
      atom: true,
    };
  },
  selectable:true,
  // draggable:true,
  atom:true,

  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element) => {
          const img = resolveImageEl(element);
          const src=img.dataset.src || img.getAttribute('src');
          try { return decodeURIComponent(src||''); } catch { return src||''; }
        },
      },
      alt: {
        default: null,
        parseHTML: (element) => {
          const img = resolveImageEl(element);

          return img.getAttribute('alt');
        },
      },
      title: {
        default: null,
      },
      width: {
        default: 'auto',
      },
      height: {
        default: 'auto',
      },
      hasTrigger: {
        default: false,
      },
      error: {
        default: null,
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setEmptyImage:
        (attrs = {}) =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name, attrs }).run();
        },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageWrapper);
  },

  addProseMirrorPlugins() {
    const pending = new Map<symbol, SelectionBookmark>();
    return [new Plugin({
      key: new PluginKey('imageHandler'),
      state: {
        init: () => null,
        apply(transaction) {
          for (const [id, bookmark] of pending) pending.set(id, bookmark.map(transaction.mapping));
          return null;
        },
      },
      view: () => ({ destroy: () => pending.clear() }),
      props: {
        handlePaste(view, event) {
          const images = Array.from(event.clipboardData?.items || []).filter(item => item.type.startsWith('image/'))
            .map(item => item.getAsFile()).filter((image): image is File => !!image);
          if (!images.length) return false;
          event.preventDefault();
          const app=useAppStore(), documentStore=useEditorStore();
          if (app.lifecycleBusy || app.saving || app.exporting || !view.editable) return true;
          const path=app.filepath, version=documentStore.renderVersion;
          const id=Symbol('paste-images');
          pending.set(id,view.state.selection.getBookmark());
          app.resourceTasks++;
          const current=()=>!view.isDestroyed && view.editable && !app.lifecycleBusy
            && app.filepath===path && documentStore.renderVersion===version && pending.has(id);
          void (async()=>{
            try {
              for (const image of images) {
                const data=await new Promise<string>((resolve,reject)=>{
                  const reader=new FileReader();
                  reader.onload=()=>typeof reader.result==='string' ? resolve(reader.result) : reject(new Error('Invalid image data'));
                  reader.onerror=()=>reject(reader.error||new Error('Image read failed'));
                  reader.onabort=()=>reject(new Error('Image read cancelled'));
                  reader.readAsDataURL(image);
                });
                if(!current())break;
                const response=await saveImage(path,image.name,data) as {code:number;info:string};
                if(!response || response.code!==0 || !response.info)throw new Error(response?.info||'Image upload failed');
                if(!current())break;
                const selection=pending.get(id)!.resolve(view.state.doc);
                const node=view.state.schema.nodes.image.create({src:response.info.replace(/\\/g,'/'),alt:image.name});
                const transaction=view.state.tr.setSelection(selection).replaceSelectionWith(node);
                view.dispatch(transaction);
                pending.set(id,view.state.selection.getBookmark());
              }
            } catch(error) {
              void appLog.error('Image insert failed: '+String(error));
              if(current())try { await message(i18n.global.t('imageInsertFailed'),{title:'MarkNote',kind:'error'}); }
              catch(dialogError){void appLog.error('Image feedback failed: '+String(dialogError));}
            } finally {
              pending.delete(id);
              app.resourceTasks=Math.max(0,app.resourceTasks-1);
            }
          })();
          return true;
        },
      },
    })];
  },
});
