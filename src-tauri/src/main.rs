// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[macro_use]
extern crate lazy_static;

shadow_rs::shadow!(build);

use std::{sync::Mutex, collections::HashMap};

use tauri::{Manager, Window};
use tauri_plugin_log::{TargetKind, Target};

use crate::utils::{set_shadow, IS_MACOS};

mod model;
mod utils;
mod resp;
mod db;
mod cmd;
mod log_conf;

pub struct OpenedUrls(Mutex<Option<Vec<url::Url>>>);

lazy_static!{
    pub static ref BUILD_MAP:HashMap<String,String>={
        let mut map=HashMap::new();
        map.insert("PKG_VERSION".into(), format!("{}",build::PKG_VERSION));         // current package version. e.g. '1.3.15-beta2'
        map.insert("BRANCH".into(), format!("{}",build::BRANCH));              // the branch, e.g. 'master'
        map.insert("SHORT_COMMIT".into(), format!("{}",build::SHORT_COMMIT));        // short commit hash, e.g. '8405e28e'
        map.insert("COMMIT_HASH".into(), format!("{}",build::COMMIT_HASH));         // full commit hash, e.g. '8405e28e64080a09525a6cf1b07c22fcaf71a5c5'
        map.insert("COMMIT_DATE".into(), format!("{}",build::COMMIT_DATE));         // commit date, e.g. '2021-08-04 12:34:03 +00:00'
        map.insert("COMMIT_AUTHOR".into(), format!("{}",build::COMMIT_AUTHOR));       // commit author, e.g. 'baoyachi'
        map.insert("COMMIT_EMAIL".into(), format!("{}",build::COMMIT_EMAIL));        // commit email, e.g. 'example@gmail.com'
    
        map.insert("BUILD_OS".into(), format!("{}",build::BUILD_OS));            // the OS that built the binary, e.g. 'macos-x86_64'
        map.insert("RUST_VERSION".into(), format!("{}",build::RUST_VERSION));        // rustc version e.g. 'rustc 1.45.0 (5c1f21c3b 2020-07-13)'
        map.insert("RUST_CHANNEL".into(), format!("{}",build::RUST_CHANNEL));        // rust toolchain e.g. 'stable-x86_64-apple-darwin (default)'
        map.insert("CARGO_VERSION".into(), format!("{}",build::CARGO_VERSION));       // cargo version e.g. 'cargo 1.45.0 (744bd1fbb 2020-06-15)'
    
        map.insert("PROJECT_NAME".into(), format!("{}",build::PROJECT_NAME));        // your project name, e.g. 'shadow-rs'
        map.insert("BUILD_TIME".into(), format!("{}",build::BUILD_TIME));          // time when start build occurred, e.g. '2020-08-16 14:50:25'
        map.insert("BUILD_RUST_CHANNEL".into(), format!("{}",build::BUILD_RUST_CHANNEL)); 
        
        map
    };
}


fn main() {
    
    tauri::Builder::default()
        .manage(OpenedUrls(Default::default()))
        .setup(|app| {
            log::info!("start MarkNote");
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_global_shortcut::Builder::default().build())?;
            #[cfg(any(windows, target_os = "linux"))]
            {
                // NOTICE: `args` may include URL protocol (`your-app-protocol://`) or arguments (`--`) if app supports them.
                let mut urls = Vec::new();
                let args: Vec<String> = std::env::args().skip(1).collect();
                for arg in args {
                    if let Ok(url) = url::Url::parse(&arg) {
                        urls.push(url);
                    }
                }

                if !urls.is_empty() {
                    app.state::<OpenedUrls>().0.lock().unwrap().replace(urls);
                }
            }
            let window = app.get_window("main").unwrap();
            
            window.set_decorations(IS_MACOS).unwrap();
            #[cfg(debug_assertions)]
            window.open_devtools();
            set_shadow(app.get_window("main").unwrap());
            Ok(())
        })
        .on_page_load(|window,_|{
            window.eval(&format!("window.os='{}'",std::env::consts::OS)).unwrap();
        })
        .invoke_handler(tauri::generate_handler![
            cmd::file::save_md,
            cmd::file::read_md,
            cmd::file::read_md_to_html,
            cmd::file::save_image,
            cmd::file::save_image_path,
            cmd::file::export_html,
            cmd::file::export_image,
            cmd::file::export_pdf,
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
            cmd::utils::platform,
            cmd::utils::themes,
            cmd::utils::build_info,
            cmd::utils::trigger_paste,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_app::init())
        .plugin(tauri_plugin_log::Builder::default().targets([
            Target::new(TargetKind::LogDir{file_name:Some("marknote".into())}),
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::Webview),
        ]).build())
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = event {
                app.state::<OpenedUrls>().0.lock().unwrap().replace(urls);
            }
        });
}
