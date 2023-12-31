import { Image as BuiltInImage } from '@tiptap/extension-image';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import ImageWrapper from './wrapper/ImageWrapper.vue';
import { Plugin, PluginKey } from 'prosemirror-state';
import { saveImage } from '../api/file';
import {useAppStore} from '../store/app';

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
          return decodeURIComponent(src||'');
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

  // @ts-ignore
  addProseMirrorPlugins() {
    return [
        new Plugin({
            key: new PluginKey('imageHandler'),
            props: {
                handlePaste: (view, event) => {
                    const appStore=useAppStore();
                    // @ts-ignore
                    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
                    console.log('paste',items);
                    for (const item of items) {
                      if (item.type.indexOf("image") === 0) {
                            event.preventDefault();
                            const {schema} = view.state;
                            
                            const image = item.getAsFile();
                            const reader = new FileReader();
                            
                            reader.onload = (e) => {
                              const base64=e.target?.result;
                              // console.log('reader image',base64);
                              if(base64&&appStore.filepath){
                                saveImage(appStore.filepath,image.name,base64 as string).then((resp:any)=>{
                                  if(resp.code===0){
                                    let src=resp.info;
                                    // if(src.startsWith('http://')||src.startsWith('https://')){

                                    // }else{
                                    //   src='img:///'+src;
                                    // }
                                    const node = schema.nodes.image.create({
                                        src: src.replace(/\\/g,'/'),
                                        alt: image.name
                                    });
                                    const transaction = view.state.tr.replaceSelectionWith(node);
                                    view.dispatch(transaction)
                                  }
                                })
                              }
                              
                            };
                            reader.onerror = function (e) {
                              console.error(e);
                            }
                            reader.readAsDataURL(image);
                      }
                    }
                },

                handleDOMEvents: {
                    drop: (_view, _event) => {
                        // const hasFiles =
                        //     event.dataTransfer &&
                        //     event.dataTransfer.files &&
                        //     event.dataTransfer.files.length;

                        // if (!hasFiles) {
                        //     return false;
                        // }

                        // const images = Array.from(
                        //     event.dataTransfer?.files ?? []
                        // ).filter((file) => /image/i.test(file.type));

                        // if (images.length === 0) {
                        //     return false;
                        // }

                        // event.preventDefault();

                        // const { schema } = view.state;
                        // const coordinates = view.posAtCoords({
                        //     left: event.clientX,
                        //     top: event.clientY,
                        // });
                        // if (!coordinates) return false;

                        // images.forEach(async (image) => {
                        //     console.log('drop image',image);
                        //     // const node = schema.nodes.image.create({
                        //     //     src: await uploadFunction(image),
                        //     // });
                        //     // const transaction = view.state.tr.insert(coordinates.pos, node);
                        //     // view.dispatch(transaction);

                        // });

                        return true;
                    },
                },
            }
        }),
    ];
  }
});