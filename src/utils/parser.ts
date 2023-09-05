import { invoke } from "@tauri-apps/api/tauri";
import TurndownService from "turndown/lib/turndown.es";
import {gfm} from "turndown-plugin-gfm";

export async function md2html(md: string) {
  const value: string = await invoke('to_html', { md });
  console.log(value);
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  // console.log(doc);
  const taskItems = doc.querySelectorAll('ul>li>input[type="checkbox"]');
  for (let i = 0; i < taskItems.length; i++) {
    const taskItem = taskItems[i];
    console.log(taskItem);
    taskItem.removeAttribute('disabled');

    const li = taskItem.parentElement;
    li?.parentElement?.setAttribute('data-type', 'taskList');

    li?.setAttribute('data-checked', taskItem.getAttribute('checked') || 'false');
    const label = document.createElement('label');
    label.contentEditable = 'false';
    const span = document.createElement('span');

    const content = document.createElement('div');
    li?.appendChild(label);

    li?.childNodes.forEach(node => {
      if (node.nodeType === 3) {
        content.appendChild(node);
      }
    })

    label.appendChild(taskItem);
    label.appendChild(span);
    li?.appendChild(content);
  }
  return doc.body.innerHTML;
}


export function html2md(html:string):string{
  const turndownService:TurndownService=new TurndownService({
    headingStyle:'atx',

  });
  turndownService.use(gfm);
  turndownService.addRule('codeblock', {
    filter: ['pre'],
    replacement: function (content:string,node:HTMLElement) {
      const code=node.querySelector('code');
      var lang='';
      for (let i = 0; code&&i < code?.classList.length; i++) {
        const className = code.classList[i];
        if(className.startsWith('language-')){
          lang=className.substring(9);
          break;
        }
      }
      return '``` '+lang+'\n'+ content + '\n```'
    }
  });
  turndownService.addRule('table', {
    filter: ['table'],
    replacement: function (content:string,node:HTMLElement) {
      console.log(node,content);
      var md='';
      const trs=node.querySelectorAll('tr');
      for (let i = 0; i < trs.length; i++) {
        const tr = trs[i];
        md+='|';
        var head='|';
        for (let j = 0; j < tr.children.length; j++) {
          const td = tr.children[j];
          md+=td.textContent+'|';
          head+='-|';
        }
        md+='\n';
        if(i===0){
          md+=head+'\n';
        }
        
        
      }
      return md//'``` '+lang+'\n'+ content + '\n```'
    }
  });

  const parser=new DOMParser();
  const doc=parser.parseFromString(html,'text/html');
  const taskItems = doc.querySelectorAll('ul[data-type="taskList"]>li');
  for (let i = 0; i < taskItems.length; i++) {
    const taskItem = taskItems[i];


    const input=taskItem.querySelector('input[type="checkbox"]')?.cloneNode();
    const content=taskItem.querySelector('div>p')?.cloneNode();
    taskItem.innerHTML='';
    if(input)
    taskItem.appendChild(input);
    if(content)
    taskItem.appendChild(content);
  }

  return turndownService.turndown(doc.body) as string;

}