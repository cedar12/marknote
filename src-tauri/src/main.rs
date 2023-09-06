// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, sync::atomic::{AtomicUsize, Ordering}};


use pulldown_cmark::Options;
use tauri::{Manager, Window, WindowUrl};

mod resp;

static WINDOW_ID:AtomicUsize=AtomicUsize::new(1);

static IS_MACOS:bool=cfg!(target_os = "macos");

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn to_html(md: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_FOOTNOTES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_SMART_PUNCTUATION);
    let parser = pulldown_cmark::Parser::new_ext(md,options);

    // Write to a new String buffer.
    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, parser);
    return html_output;
}

#[tauri::command]
fn read_md(path: &str) -> resp::Resp<String> {
    match fs::read_to_string(path) {
        Ok(data) => resp::data(Some(data)),
        Err(e) => resp::err(e.to_string()),
    }
}

#[tauri::command]
fn save_md(path: &str,md:&str) -> resp::Resp<String> {
    match fs::write(path, md) {
        Ok(_) => resp::data(None),
        Err(e) => resp::err(e.to_string()),
    }
}

#[tauri::command]
fn set_shadow(win: Window) {
    if cfg!(windows){
        // let window = app.get_window(label).unwrap();
        window_shadows::set_shadow(&win, true).expect("Unsupported platform!");
    }
}
#[cfg(not(target_os="macos"))]
#[tauri::command]
async fn open_window(handle: tauri::AppHandle) {
    let window_id=WINDOW_ID.fetch_add(1, Ordering::SeqCst);
    
    let win = tauri::WindowBuilder::new(
        &handle,
        format!("window_{}",window_id), /* the unique window label */
        WindowUrl::App("index.html".into())
      ).decorations(IS_MACOS).inner_size(500f64, 600f64).min_inner_size(400f64, 400f64).build().unwrap();
    
    set_shadow(win);
}
#[cfg(target_os="macos")]
#[tauri::command]
async fn open_window(handle: tauri::AppHandle) {
    let window_id=WINDOW_ID.fetch_add(1, Ordering::SeqCst);
    
    let win = tauri::WindowBuilder::new(
        &handle,
        format!("window_{}",window_id), /* the unique window label */
        WindowUrl::App("index.html".into())
      ).decorations(IS_MACOS).inner_size(500f64, 600f64).min_inner_size(400f64, 400f64).title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true).build().unwrap();
    set_shadow(win);
}

#[cfg(not(target_os="macos"))]
#[tauri::command]
async fn open_preferences(handle: tauri::AppHandle) {
   match handle.get_window("preferences"){
    Some(window)=>{
        window.set_focus().unwrap();
    },
    None=>{
        let win = tauri::WindowBuilder::new(
            &handle,
            "preferences", /* the unique window label */
            WindowUrl::App("index.html?preferences=open".into())
            ).decorations(IS_MACOS).min_inner_size(600f64, 400f64).build().unwrap();
        set_shadow(win);
    }
   }
    
    
}

#[cfg(target_os="macos")]
#[tauri::command]
async fn open_preferences(handle: tauri::AppHandle) {
    match handle.get_window("preferences"){
        Some(window)=>{
            window.set_focus().unwrap();
        },
        None=>{
            let win = tauri::WindowBuilder::new(
                &handle,
                "preferences", /* the unique window label */
                WindowUrl::App("index.html?preferences=open".into())
            ).decorations(IS_MACOS).min_inner_size(600f64, 400f64).title_bar_style(tauri::TitleBarStyle::Overlay).hidden_title(true).build().unwrap();
        }
    }
    
    
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window=app.get_window("main").unwrap();
            window.set_decorations(IS_MACOS).unwrap();
            
            set_shadow(app.get_window("main").unwrap());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, to_html,save_md, read_md,open_window,open_preferences])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
