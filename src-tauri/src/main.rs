// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, path::PathBuf, sync::atomic::{AtomicUsize, Ordering}};

use pulldown_cmark::{html, Options, Parser};

use tauri::{Manager, Window, WindowUrl};

mod resp;

static WINDOW_ID:AtomicUsize=AtomicUsize::new(1);

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn to_html(md: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_HEADING_ATTRIBUTES);
    options.insert(Options::ENABLE_TABLES);
    // let mut is_list=false;
    let parser = Parser::new_ext(md, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    //<li><input disabled="" type="checkbox"
    // return html_output.replace("<ul><li><input disabled=\"\" type=\"checkbox\"", "<ul  data-type=\"taskItem\"><li data-type=\"taskItem\"><input disabled=\"\" type=\"checkbox\"");
    return html_output;
}

#[tauri::command]
fn read_md(path: &str) -> resp::Resp<String> {
    match fs::read_to_string(path) {
        Ok(data) => resp::data(Some(to_html(data.as_str()))),
        Err(e) => resp::err(e.to_string()),
    }
}

#[tauri::command]
fn set_shadow(win: Window) {
    if cfg!(windows)||cfg!(mac){
        // let window = app.get_window(label).unwrap();
        window_shadows::set_shadow(&win, true).expect("Unsupported platform!");
    }
}
#[tauri::command]
async fn open_window(handle: tauri::AppHandle) {
    // let main_window=handle.get_window("main").unwrap();
    // println!("url->{}",main_window.url());
    let window_id=WINDOW_ID.fetch_add(1, Ordering::SeqCst);
    
    let win = tauri::WindowBuilder::new(
        &handle,
        format!("window_{}",window_id), /* the unique window label */
        WindowUrl::App("index.html".into())//WindowUrl::External("https://tauri.app/".parse().unwrap())
      ).decorations(false).build().unwrap();
    set_shadow(win);
}

#[tauri::command]
async fn open_preferences(handle: tauri::AppHandle) {
    // let main_window=handle.get_window("main").unwrap();

    // let window_id=WINDOW_ID.fetch_add(1, Ordering::SeqCst);
    let win = tauri::WindowBuilder::new(
        &handle,
        "preferences", /* the unique window label */
        WindowUrl::App("index.html#/preferences".into())//WindowUrl::External("https://tauri.app/".parse().unwrap())
      ).decorations(false).build().unwrap();
    set_shadow(win);
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            set_shadow(app.get_window("main").unwrap());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, to_html, read_md,open_window,open_preferences])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
