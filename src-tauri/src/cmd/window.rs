use std::sync::atomic::{AtomicUsize,Ordering};
use tauri::WindowUrl;
use tauri::Manager;

use crate::utils::*;

pub static WINDOW_ID: AtomicUsize = AtomicUsize::new(1);


#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn open_window(handle: tauri::AppHandle) {
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
pub async fn open_window(handle: tauri::AppHandle) {
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
    #[cfg(debug_assertions)]
    {
        win.open_devtools();
    }
    set_shadow(win);
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn open_preferences(handle: tauri::AppHandle) {
    match handle.get_window("preferences") {
        Some(window) => {
            window.set_focus().unwrap();
        }
        None => {
            let win_url=WindowUrl::App("index.html?preferences=open".into());
            println!("{:?}",win_url.to_string());
            let win = tauri::WindowBuilder::new(
                &handle,
                "preferences", /* the unique window label */
                win_url,
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
pub async fn open_preferences(handle: tauri::AppHandle){
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
            .inner_size(800f64, 600f64)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .visible(false)
            .build()
            .unwrap();
        }
    }
}



#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn open_about(handle: tauri::AppHandle) {
    match handle.get_window("about") {
        Some(window) => {
            window.set_focus().unwrap();
        }
        None => {
            let win = tauri::WindowBuilder::new(
                &handle,
                "about", /* the unique window label */
                WindowUrl::App("index.html?about=open".into()),
            )
            .decorations(IS_MACOS)
            // .min_inner_size(300f64, 200f64)
            .inner_size(300f64,250f64)
            .resizable(false)
            .visible(false)
            .center()
            .build()
            .unwrap();
            set_shadow(win);
        }
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn open_about(handle: tauri::AppHandle){
    match handle.get_window("about") {
        Some(window) => {
            window.set_focus().unwrap();
        }
        None => {
            let win = tauri::WindowBuilder::new(
                &handle,
                "about", /* the unique window label */
                WindowUrl::App("index.html?about=open".into()),
            )
            .decorations(IS_MACOS)
            .inner_size(300f64,250f64)
            .resizable(false)
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .center()
            .visible(false)
            .build()
            .unwrap();
        }
    }
}