// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[macro_use]
extern crate lazy_static;

use std::vec;

use tauri::{Manager, http::ResponseBuilder};

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
            
            Ok(())
        })
        // .on_window_event(|event| {
        //     let window=event.window();
        //     let label=window.label();
        //     // println!("window event {:?}",label);
        //     if label!="about"&&label!="preferences"{
        //         match event.event() {
        //             tauri::WindowEvent::CloseRequested{api,..} => {
                        
        //                 println!("close request {:?}",label);
        //                 let api=api.clone();
        //                 window.listen("close", move|_|{
        //                     api.prevent_close();
        //                 });
        //                 window.emit("window-close", ()).unwrap();
                        
        //             }
        //             _ => {}
        //         }
        //     }
        // })
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
