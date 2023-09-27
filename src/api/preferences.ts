import { invoke } from "@tauri-apps/api/tauri";

export function save(save_type:string,path:string){
  return invoke('save_image_type', { saveType:save_type,path:path });
}

export function getConfig(){
  return invoke('get_config');
}
export function ftype(){
  return invoke('set_ftype');
}