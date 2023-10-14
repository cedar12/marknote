// import { invoke } from "@tauri-apps/api/tauri";

const invoke=window.__TAURI_INVOKE__;


export function args():Promise<string[]>{
  return invoke('cmd_args');
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