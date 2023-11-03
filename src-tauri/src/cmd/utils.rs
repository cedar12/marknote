use std::{process::Command, path::PathBuf, collections::HashMap};

use tauri::{App, AppHandle, Manager, State};

use crate::OpenedUrls;

#[tauri::command]
pub fn cmd_args(state: State<OpenedUrls>) -> Vec<url::Url> {
    // let args: Vec<String> = std::env::args().collect();
    let res = state.0.lock().unwrap();
    if let Some(urls) = res.as_ref() {
        log::info!("{:?}", urls);
        return urls.clone();
    }
    vec![]
}

#[tauri::command]
pub fn log_info(str: &str) {
    log::info!("{}", str);
}
#[tauri::command]
pub fn log_error(str: &str) {
    log::error!("{}", str);
}
#[tauri::command]
pub fn log_debug(str: &str) {
    log::debug!("{}", str);
}

#[tauri::command]
pub fn open_explorer(path: &str) {
    // Windows
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", path])
            .spawn()
            .unwrap();
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").args(["-R",path]).spawn().unwrap();
    }
}

#[tauri::command]
pub fn platform() -> &'static str {
    std::env::consts::OS
}

#[tauri::command]
pub fn build_info() -> HashMap<String,String> {
    crate::BUILD_MAP.clone()
}

#[tauri::command]
pub fn trigger_paste() {
    use enigo::{Enigo,Key,KeyboardControllable};
    let mut enigo = Enigo::new();
    if crate::utils::IS_MACOS{
        enigo.key_down(Key::Meta);
    }else{
        enigo.key_down(Key::Control);
    }
    enigo.key_click(Key::Layout('v'));
    if crate::utils::IS_MACOS{
        enigo.key_up(Key::Meta);
    }else{
        enigo.key_up(Key::Control);
    }
}

#[tauri::command]
pub fn themes(app: AppHandle) -> Vec<String> {
    let result = app.path().resource_dir();
    match result {
        Ok(dir) => {
            let mut vec = vec![];
            for entry in std::fs::read_dir(dir.join("themes")).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                if path.is_file() && path.extension().unwrap() == "json"{
                  let read_result=std::fs::read_to_string(path);
                  match read_result {
                    Ok(json_str)=>{
                      let valid_result=crate::utils::schema::validate(&json_str);
                      if let Err(e) = valid_result {
                        log::error!("{:?}",e);
                        continue;
                      }
                      vec.push(json_str.to_string());    
                    },
                    Err(e)=>{
                      log::error!("{:?}",e);
                    }
                  };
                    
                }
            }
            vec
        }
        Err(_) => vec![],
    }
}
