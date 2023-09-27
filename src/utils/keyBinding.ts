import hotkeys, { HotkeysEvent } from 'hotkeys-js';
import {useAppStore} from '../store/app';

export interface KeyBinding{
  description:string[],
  key:string,
  replace?:string,
}

const defaultKeyBinding:KeyBinding[]=[
  {
    description:['file','newWindow'],
    key:'Mod+N',
  },
  {
    description:['file','openFile'],
    key:'Mod+O',
  },
  {
    description:['file','save'],
    key:'Mod+S',
  },
  {
    description:['file','saveAs'],
    key:'Mod+Shift+S',
  },
  {
    description:['file','preferences'],
    key:'Mod+.',
  },
  {
    description:['file','closeWindow'],
    key:'Mod+W',
  },
  {
    description:['file','quit'],
    key:'Mod+Q',
  }

  ,
  {
    description:['edit','cut'],
    key:'Mod+X',
  },
  {
    description:['edit','undo'],
    key:'Mod+Z',
  },
  {
    description:['edit','redo'],
    key:'Mod+Y',
  },
  {
    description:['paragraph','normalText'],
    key:'Mod+Alt+0',
  },
  {
    description:['paragraph','heading1'],
    key:'Mod+Alt+1',
  },
  {
    description:['paragraph','heading2'],
    key:'Mod+Alt+2',
  },
  {
    description:['paragraph','heading3'],
    key:'Mod+Alt+3',
  },
  {
    description:['paragraph','heading4'],
    key:'Mod+Alt+4',
  },
  {
    description:['paragraph','heading5'],
    key:'Mod+Alt+5',
  },
  {
    description:['paragraph','heading6'],
    key:'Mod+Alt+6',
  },
  {
    description:['paragraph','table'],
    key:'Mod+Shift+T',
  },
  {
    description:['paragraph','codeFences'],
    key:'Mod+Alt+C',
  },
  {
    description:['paragraph','bulletList'],
    key:'Mod+Shift+8',
  },
  {
    description:['paragraph','orderedList'],
    key:'Mod+Shift+7',
  },
  {
    description:['paragraph','taskList'],
    key:'Mod+Shift+9',
  },
  {
    description:['paragraph','quoteBlock'],
    key:'Mod+Shift+B',
  },
  {
    description:['paragraph','paragraph'],
    key:'Mod+Enter',
  },
  {
    description:['view','outliner'],
    key:'Alt+Z',
  }
];

type KeyBindingFn=(bind:KeyBinding,handler: HotkeysEvent)=>boolean|void;

export class KeyBindingBuilder{
  private binds:KeyBinding[];
  private fn:KeyBindingFn|null=null;
  constructor(binds=defaultKeyBinding){
    this.binds=binds;
    this.bind();
  }

  getKey(desc:string){
    const bind=this.binds.find(b=>b.description.join('.')===desc);
    if(bind?.replace){
      bind.key=bind.replace;
    }
    return bind;
  }

  unbind(){
    hotkeys.unbind();
  }

  on(fn:KeyBindingFn){
    this.fn=fn;
  }

  bind(){
    const appStore=useAppStore();
    this.binds.forEach(bind=>{
      const key=(bind.replace?bind.replace:bind.key).replace(/Mod/g,appStore.platform==='darwin'?'command':'ctrl').toLocaleLowerCase();
      hotkeys(key, bind.description[0], (event, handler)=>{
        if(this.fn){
          const result=this.fn(bind,handler);
          if(result===true&&event){
            event.preventDefault();
          }
        }
      });
    });
  }

}