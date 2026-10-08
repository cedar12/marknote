use std::{process::Command, path::PathBuf, collections::HashMap};

use tauri::{App, AppHandle, Manager, State};

use crate::OpenedUrls;

#[tauri::command]
pub fn cmd_args(state: State<OpenedUrls>) -> Vec<url::Url> {
    // let args: Vec<String> = std::env::args().collect();
    let res = state.0.lock().unwrap();
    if let Some(urls) = res.as_ref() {
        log::info!("{:?}", urls);
        return urls.clone();
    }
    vec![]
}

#[tauri::command]
pub fn log_info(str: &str) {
    log::info!("{}", str);
}
#[tauri::command]
pub fn log_error(str: &str) {
    log::error!("{}", str);
}
#[tauri::command]
pub fn log_debug(str: &str) {
    log::debug!("{}", str);
}

#[tauri::command]
pub fn open_explorer(path: &str) {
    // Windows
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", path])
            .spawn()
            .unwrap();
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").args(["-R",path]).spawn().unwrap();
    }
}

#[tauri::command]
pub fn platform() -> &'static str {
    std::env::consts::OS
}

#[tauri::command]
pub fn build_info() -> HashMap<String,String> {
    crate::BUILD_MAP.clone()
}

#[tauri::command]
pub async fn render_markdown(markdown: String, options: Option<crate::utils::md::MarkdownOptions>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || crate::utils::md::md_to_html_with_options(&markdown, &options.unwrap_or_default()))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn themes(app: AppHandle) -> Result<Vec<String>, super::theme::ThemeError> {
    super::theme::theme_json(app)
}
