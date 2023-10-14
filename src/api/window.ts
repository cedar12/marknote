// import { invoke } from "@tauri-apps/api/tauri";

const invoke=window.__TAURI_INVOKE__;


export function openWindow(){
  return invoke('open_window');
}
export function openPreferences(){
  return invoke('open_preferences');
}
export function openAbout(){
  return invoke('open_about');
}