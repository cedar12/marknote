// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{
    fs,
    sync::{atomic::{AtomicUsize, Ordering}},
};

use tauri::{ Manager, Window, WindowUrl, api::dialog::blocking::FileDialogBuilder};

mod utils;
mod resp;

static WINDOW_ID: AtomicUsize = AtomicUsize::new(1);

static IS_MACOS: bool = cfg!(target_os = "macos");

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command

const WIDTH:f64=600f64;
const HEIGHT:f64=600f64;
const MIN_WIDTH:f64=500f64;
const MIN_HEIGTH:f64=400f64;


#[tauri::command]
fn read_md(path: &str) -> resp::Resp<String> {
    match fs::read_to_string(path) {
        Ok(data) => resp::data(Some(data)),
        Err(e) => resp::err(e.to_string()),
    }
}

#[tauri::command]
fn save_md(path: &str, md: &str) -> resp::Resp<String> {
    match fs::write(path, md) {
        Ok(_) => resp::data(None),
        Err(e) => resp::err(e.to_string()),
    }
}

#[tauri::command]
async fn save_as_md(md:&str,title: &str) ->Result<resp::Resp<String>,String> {
    let file_path = FileDialogBuilder::new().add_filter("Markdown", &["md"]).set_title(title).save_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.to_str(){
            let filepath:String=fp.into();
            let mut resp=save_md(fp,md);
            resp.info=filepath;
            return Ok(resp);
        }
    }
    Err("".into())
}

#[tauri::command]
fn set_shadow(win: Window) {
    if cfg!(windows) {
        // let window = app.get_window(label).unwrap();
        window_shadows::set_shadow(&win, true).expect("Unsupported platform!");
    }
}
#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn open_window(handle: tauri::AppHandle) {
    let window_id = WINDOW_ID.fetch_add(1, Ordering::SeqCst);

    let win = tauri::WindowBuilder::new(
        &handle,
        format!("window_{}", window_id), /* the unique window label */
        WindowUrl::App("index.html".into()),
    )
    .decorations(IS_MACOS)
    .title("marknote")
    .inner_size(WIDTH, HEIGHT)
    .min_inner_size(MIN_WIDTH, MIN_HEIGTH)
    .visible(false)
    .build()
    .unwrap();

    set_shadow(win);
}
#[cfg(target_os = "macos")]
#[tauri::command]
async fn open_window(handle: tauri::AppHandle) {
    let window_id = WINDOW_ID.fetch_add(1, Ordering::SeqCst);

    let win = tauri::WindowBuilder::new(
        &handle,
        format!("window_{}", window_id), /* the unique window label */
        WindowUrl::App("index.html".into()),
    )
    .decorations(IS_MACOS)
    .title("marknote")
    .inner_size(WIDTH, HEIGHT)
    .min_inner_size(MIN_WIDTH, MIN_HEIGTH)
    .title_bar_style(tauri::TitleBarStyle::Overlay)
    .hidden_title(true)
    .visible(false)
    .build()
    .unwrap();
    set_shadow(win);
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn open_preferences(handle: tauri::AppHandle) {
    match handle.get_window("preferences") {
        Some(window) => {
            window.set_focus().unwrap();
        }
        None => {
            let win = tauri::WindowBuilder::new(
                &handle,
                "preferences", /* the unique window label */
                WindowUrl::App("index.html?preferences=open".into()),
            )
            .decorations(IS_MACOS)
            .min_inner_size(600f64, 400f64)
            .visible(false)
            .build()
            .unwrap();
            set_shadow(win);
        }
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn open_preferences(handle: tauri::AppHandle){
    match handle.get_window("preferences") {
        Some(window) => {
            window.set_focus().unwrap();
        }
        None => {
            let _ = tauri::WindowBuilder::new(
                &handle,
                "preferences", /* the unique window label */
                WindowUrl::App("index.html?preferences=open".into()),
            )
            .decorations(IS_MACOS)
            .min_inner_size(600f64, 400f64)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .visible(false)
            .build()
            .unwrap();
        }
    }
}

#[tauri::command]
async fn open_file(title: &str) ->Result<resp::Resp<String>,String> {
    let file_path = FileDialogBuilder::new().add_filter("Markdown", &["md"]).set_title(title).pick_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.to_str(){
            let mut resp=read_md(fp.into());
            resp.info=fp.into();
            return Ok(resp);
        }
    }
    Err("".into())
}

#[tauri::command]
async fn save_image(path:&str,base64: &str) ->Result<resp::Resp<String>,String> {
  match utils::write_image(path.into(),base64.into()){
    Ok(())=>{
      Ok(resp::ok(path.into(),None))
    },
    Err(e)=>{
      println!("{:?}",e);
      Err("".into())
    }
  }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_decorations(IS_MACOS).unwrap();
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }
            set_shadow(app.get_window("main").unwrap());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_md,
            save_as_md,
            read_md,
            open_window,
            open_preferences,
            open_file,
            save_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
