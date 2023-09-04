// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use pulldown_cmark::{Parser, Options, html,Event, Tag};
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
    let mut is_list=false;
    let parser = Parser::new_ext(md, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    //<li><input disabled="" type="checkbox"
    // return html_output.replace("<ul><li><input disabled=\"\" type=\"checkbox\"", "<ul  data-type=\"taskItem\"><li data-type=\"taskItem\"><input disabled=\"\" type=\"checkbox\"");
    return html_output;
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet,to_html])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
