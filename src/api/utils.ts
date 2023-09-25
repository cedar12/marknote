import { invoke } from "@tauri-apps/api/tauri";


export function args(){
  return invoke('args');
}