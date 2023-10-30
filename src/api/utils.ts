import { invoke } from "@tauri-apps/api/primitives";

export type PlatformType="linux"|"macos"|"ios"|"freebsd"|"dragonfly"|"netbsd"|"openbsd"|"solaris"|"android"|"windows";

export function args():Promise<string[]>{
  return invoke('cmd_args');
}
export function platform():Promise<PlatformType>{
  return invoke('platform');
}
export function findThemes():Promise<string[]>{
  return invoke('themes');
}
export function openExplorer(path:string){
  return invoke('open_explorer',{path});
}


export const log={
  info(str:string){
    return invoke('log_info',{str:str});
  },
  debug(str:string){
    return invoke('log_debug',{str:str});
  },
  error(str:string){
    return invoke('log_error',{str:str});
  }
}