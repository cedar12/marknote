// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[macro_use]
extern crate lazy_static;

use tauri::Manager;
use utils::open_with;

use crate::utils::{set_shadow, IS_MACOS};

mod model;
mod utils;
mod resp;
mod db;
mod cmd;
mod log_conf;


fn main() {
    log_conf::init();
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            window.set_decorations(IS_MACOS).unwrap();
            #[cfg(debug_assertions)]
            window.open_devtools();
            set_shadow(app.get_window("main").unwrap());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::file::save_md,
            cmd::file::read_md,
            cmd::file::save_image,
            cmd::file::save_image_path,
            cmd::dialog::save_as_md,
            cmd::dialog::open_file,
            cmd::window::open_window,
            cmd::window::open_preferences,
            cmd::window::open_about,
            cmd::preferences::save_image_type,
            cmd::preferences::get_config,
            cmd::preferences::set_ftype,
            cmd::utils::cmd_args,
            cmd::utils::log_info,
            cmd::utils::log_error,
            cmd::utils::log_debug,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
