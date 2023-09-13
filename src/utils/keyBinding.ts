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
    description:['edit','undo'],
    key:'Mod+Z',
  },
  {
    description:['edit','redo'],
    key:'Mod+Y',
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
    return this.binds.find(b=>b.description.join('.')===desc);
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
      hotkeys(key, (event, handler)=>{
        if(this.fn){
          const result=this.fn(bind,handler);
          if(result===true){
            event.preventDefault();
          }
        }
      });
    });
  }

}