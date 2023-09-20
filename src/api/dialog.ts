import { invoke } from "@tauri-apps/api/tauri";


export function saveAs(md:string,title:string){
  return invoke('save_as_md',{title:title,md:md});
}

export function openFile(title:string){
  return invoke('open_file',{title:title});
}

