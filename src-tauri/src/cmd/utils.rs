use std::process::Command;

use tauri::{State, AppHandle, Manager};

use crate::OpenedUrls;


#[tauri::command]
pub fn cmd_args(state: State<OpenedUrls>)->Vec<url::Url>{
  // let args: Vec<String> = std::env::args().collect();
  let res=state.0.lock().unwrap();
  if let Some(urls) = res.as_ref() {
      return urls.clone();
  }
  vec![]
}

#[tauri::command]
pub fn log_info(str:&str){
  log::info!("{}",str);
}
#[tauri::command]
pub fn log_error(str:&str){
  log::error!("{}",str);
}
#[tauri::command]
pub fn log_debug(str:&str){
  log::debug!("{}",str);
}


#[tauri::command]
pub fn open_explorer(path:&str){
  // Windows
  if cfg!(windows) {
    Command::new("explorer").args(["/select,", path]).spawn().unwrap();
  }else if cfg!(macos){
    Command::new( "open" )
        .args(["-R", path])
        .spawn()
        .unwrap();
  }
  
}