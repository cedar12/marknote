import { invoke } from "@tauri-apps/api/core";


export function openWindow(){
  return invoke('open_window');
}
export function rememberWindowSize(){
  return invoke<void>('remember_window_size');
}
export function restoreWindowSize(){
  return invoke<void>('restore_window_size');
}
export function openPreferences(){
  return invoke('open_preferences');
}
export function openAbout(){
  return invoke('open_about');
}
