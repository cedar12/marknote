// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[macro_use]
extern crate lazy_static;

use tauri::Manager;

use crate::utils::{set_shadow, IS_MACOS};

mod model;
mod utils;
mod resp;
mod db;
mod cmd;


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
            println!("{:?}",db::config_map().unwrap());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::file::save_md,
            cmd::file::read_md,
            cmd::file::save_image,
            cmd::dialog::save_as_md,
            cmd::dialog::open_file,
            cmd::window::open_window,
            cmd::window::open_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
