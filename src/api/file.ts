import { invoke } from "@tauri-apps/api/tauri";

export function save(path:string,md:string){
  return invoke('save_md', { path: path, md: md });
}

export function read(path:string){
  return invoke('read_md', { path: path});
}
