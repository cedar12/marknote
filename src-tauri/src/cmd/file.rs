

use crate::{resp, utils};
use super::file_version::{self, FileVersion, MarkdownResponse};
use std::{fs, io::Write, path::Path, time::{SystemTime, UNIX_EPOCH}};

pub(crate) fn write_file_safely(path:&str,content:&[u8])->std::io::Result<()> {
    let target=Path::new(path);
    if target.exists() && !target.is_file(){
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput,"save path is not a file"));
    }
    let parent=target.parent().unwrap_or_else(||Path::new("."));
    let filename=target.file_name().and_then(|name|name.to_str()).unwrap_or("marknote");
    let nonce=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let temp=parent.join(format!(".{filename}.{nonce}.tmp"));
    let backup=parent.join(format!(".{filename}.{nonce}.bak"));

    let result=(||{
        let mut file=fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        file.write_all(content)?;
        file.sync_all()?;
        drop(file);

        if target.exists(){
            fs::rename(target,&backup)?;
            if let Err(error)=fs::rename(&temp,target){
                let _=fs::rename(&backup,target);
                return Err(error);
            }
            if let Err(error)=fs::remove_file(&backup){
                log::warn!("failed to remove save backup: {error}");
            }
        }else{
            fs::rename(&temp,target)?;
        }
        Ok(())
    })();

    if result.is_err(){
        let _=fs::remove_file(&temp);
    }
    result
}

#[tauri::command(async)]
pub async fn read_md(path: &str) -> Result<MarkdownResponse, String> {
    let start_time = std::time::Instant::now();
    match file_version::read_markdown(path) {
        Ok(data) => {
            log::info!("读取{}耗时：{}毫秒",path, start_time.elapsed().as_millis());
            Ok(data)
        },
        Err(e) => Ok(MarkdownResponse::error(e)),
    }
}


#[tauri::command]
pub async fn read_md_to_html(path: &str) -> Result<resp::Resp<String>, String> {
    let start_time = std::time::Instant::now();
    match fs::read_to_string(path) {
        Ok(data) => {
            let md=utils::md::md_to_html(data.as_str());
            log::info!("读取{}耗时：{}毫秒",path, start_time.elapsed().as_millis());
            Ok(resp::data(Some(md)))
        },
        Err(e) => Ok(resp::err(e.to_string())),
    }
}

#[tauri::command(async)]
pub async fn save_md(app: tauri::AppHandle, window: tauri::WebviewWindow, path: &str, md: &str, expected_version: Option<FileVersion>) -> Result<MarkdownResponse, String> {
    let response = file_version::save_markdown_checked(path, md, expected_version.as_ref()).unwrap_or_else(MarkdownResponse::error);
    file_version::emit_saved(&app, &window, &response);
    Ok(response)
}

#[tauri::command]
pub async fn save_image(
    md_path: Option<String>,
    filename: String,
    base64: &str,
) -> Result<resp::Resp<String>, String> {
    match utils::write_cache_image(filename, base64.into()) {
        Ok(path) => {
            let result=utils::save_image(md_path, path.to_string_lossy().to_string()).await;
            if let Err(error)=fs::remove_file(&path){ log::warn!("failed to remove cached image: {error}"); }
            match result {
                Ok(save_path) => {
                    Ok(resp::ok(save_path, None))
                }
                Err(e) => {
                    Err(e.to_string())
                }
            }
        }
        Err(e) => {
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn save_image_path(md_path: Option<String>, img_path: &str) -> Result<resp::Resp<String>, String> {
    match utils::save_image(md_path, img_path.into()).await {
        Ok(save_path) => Ok(resp::ok(save_path, None)),
        Err(e) => {
            println!("{:?}", e);
            Err(e.to_string())
        }
    }
}

// #[tauri::command]
// async fn copy_image(path:&str) ->Result<resp::Resp<String>,String> {
//   match utils::write_image(path.into(),base64.into()){
//     Ok(())=>{
//       Ok(resp::ok(path.into(),None))
//     },
//     Err(e)=>{
//       println!("{:?}",e);
//       Err("".into())
//     }
//   }
// }

#[tauri::command]
pub async fn export_html(path: &str, html: &str) -> Result<resp::Resp<String>, String> {
    match write_file_safely(path, html.as_bytes()) {
        Ok(()) => Ok(resp::ok(path.into(), None)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn ls_md(path: &str) -> Result<resp::Resp<utils::PathInfo>, String> {
    if let Ok(mut path_info) = utils::PathInfo::new(path) {
        match utils::ls_path(&mut path_info) {
            Ok(()) => Ok(resp::ok(path.into(), Some(path_info))),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Ok(resp::err("".into()))
    }
}


#[tauri::command]
pub async fn export_image(
    path: String,
    base64: String,
) -> Result<resp::Resp<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        write_export_image(&path, &base64).map_err(|error| error.to_string())?;
        Ok(resp::ok(path, None))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn write_export_image(path: &str, data_url: &str) -> anyhow::Result<()> {
    let bytes = utils::image_export::decode_data_url(path, data_url)?;
    write_file_safely(path, &bytes)?;
    Ok(())
}

#[tauri::command]
pub async fn export_pdf(path: String, html: String) -> Result<resp::Resp<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cache = utils::get_cache_dir();
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        cache.push(format!("pdf-{nonce}.html"));
        let cache_path = cache.to_str().ok_or_else(|| "PDF cache path is not valid UTF-8".to_string())?;
        let result = (|| {
            write_file_safely(cache_path, html.as_bytes()).map_err(|error| error.to_string())?;
            utils::pdf::html_to_pdf(&cache, &path, utils::pdf::pdf_options(), utils::pdf::launch_options())
                .map_err(|error| error.to_string())?;
            Ok(resp::ok(path, None))
        })();
        if cache.exists() {
            if let Err(error) = fs::remove_file(&cache) {
                log::warn!("failed to remove PDF cache file: {error}");
            }
        }
        result
    }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn collect_word_equations(markdown: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || utils::docx::collect_equations(&markdown))
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_word(
    path: String,
    markdown: String,
    source_path: Option<String>,
    diagram_images: std::collections::HashMap<String, String>,
    equations: std::collections::HashMap<String, String>,
) -> Result<resp::Resp<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = utils::docx::markdown_to_docx_with_assets(&markdown, source_path.as_deref(), diagram_images, equations)
            .map_err(|error| error.to_string())?;
        write_file_safely(&path, &bytes).map_err(|error| error.to_string())?;
        Ok(resp::ok(path, None))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod image_export_tests {
    use super::*;
    use base64::{engine::general_purpose, Engine as _};
    use image::{DynamicImage, ImageOutputFormat};
    use std::{io::Cursor, path::PathBuf};

    struct ExportDirectory(PathBuf);

    impl ExportDirectory {
        fn new() -> Self {
            let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
            let path = std::env::temp_dir().join(format!("marknote-image-export-{}-{nonce}", std::process::id()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn image_path(&self) -> String {
            self.0.join("export.png").to_string_lossy().into_owned()
        }
    }

    impl Drop for ExportDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn png_data() -> (String, Vec<u8>) {
        let mut bytes = Cursor::new(Vec::new());
        DynamicImage::new_rgb8(3, 2).write_to(&mut bytes, ImageOutputFormat::Png).unwrap();
        let bytes = bytes.into_inner();
        let data_url = format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(&bytes));
        (data_url, bytes)
    }

    #[test]
    fn invalid_export_preserves_existing_file() {
        let directory = ExportDirectory::new();
        let path = directory.image_path();
        fs::write(&path, b"existing image").unwrap();
        assert!(write_export_image(&path, "data:image/png;base64,aGVsbG8=").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"existing image");
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
    }

    #[test]
    fn export_replaces_existing_file_without_temporary_files() {
        let directory = ExportDirectory::new();
        let path = directory.image_path();
        fs::write(&path, b"existing image").unwrap();
        let (data_url, bytes) = png_data();
        write_export_image(&path, &data_url).unwrap();
        assert_eq!(fs::read(&path).unwrap(), bytes);
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
    }

    #[test]
    fn export_rejects_a_directory_without_moving_it() {
        let directory = ExportDirectory::new();
        let path = directory.image_path();
        fs::create_dir(&path).unwrap();
        fs::write(Path::new(&path).join("existing.txt"), b"keep this file").unwrap();
        let (data_url, _) = png_data();
        assert!(write_export_image(&path, &data_url).is_err());
        assert!(Path::new(&path).is_dir());
        assert_eq!(fs::read(Path::new(&path).join("existing.txt")).unwrap(), b"keep this file");
        assert_eq!(fs::read_dir(&directory.0).unwrap().count(), 1);
    }
}
