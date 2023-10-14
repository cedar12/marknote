// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[macro_use]
extern crate lazy_static;


use std::{sync::Mutex, slice::Windows};

use tauri::Manager;

use crate::utils::{set_shadow, IS_MACOS};

mod model;
mod utils;
mod resp;
mod db;
mod cmd;
mod log_conf;

pub struct OpenedUrls(Mutex<Option<Vec<url::Url>>>);


fn main() {
    log_conf::init();
    tauri::Builder::default()
        .manage(OpenedUrls(Default::default()))
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                // NOTICE: `args` may include URL protocol (`your-app-protocol://`) or arguments (`--`) if app supports them.
                let mut urls = Vec::new();
                for arg in env::args().skip(1) {
                if let Ok(url) = url::Url::parse(&arg) {
                    urls.push(url);
                }
                }

                if !urls.is_empty() {
                app.state::<OpenedUrls>().0.lock().unwrap().replace(urls);
                }
            }

            let opened_urls = if let Some(urls) = &*app.state::<OpenedUrls>().0.lock().unwrap() {
                urls
                .iter()
                .map(|u| u.as_str().replace("\\", "\\\\"))
                .collect::<Vec<_>>()
                .join(", ")
            } else {
                "".into()
            };
            let window = app.get_window("main").unwrap();
            // let _=window.eval(&format!("setTimeout(window.onFileOpen(`{opened_urls}`),100)"));
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
            cmd::file::export_html,
            cmd::file::ls_md,
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
            cmd::utils::open_explorer,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_app::init())
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = event {
                /*
                if let Some(w) = app.get_window("main") {
                    let urls = urls
                        .iter()
                        .map(|u| u.as_str())
                        .collect::<Vec<_>>()
                        .join(",");
                    let _ = w.eval(&format!("window.onFileOpen(`{urls}`)"));
                } */

                app.state::<OpenedUrls>().0.lock().unwrap().replace(urls);
            }
        });
}
