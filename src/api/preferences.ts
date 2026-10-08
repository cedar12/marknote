import { invoke } from "@tauri-apps/api/core";
import type { MarkdownPreferences } from '../utils/markdownPreferences';

export function save(save_type:string,path:string){
  return invoke('save_image_type', { saveType:save_type,path:path });
}

export function getConfig(){
  return invoke('get_config');
}
export function saveMarkdownPreferences(options: MarkdownPreferences): Promise<{ code: number; info: string }> {
  return invoke('save_markdown_preferences', { options });
}
export function ftype(){
  return invoke('set_ftype');
}
