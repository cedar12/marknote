use super::{
    attachments::{encode_path, unique_file},
    ImageSaveType,
};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};

const UPLOAD_TIMEOUT: Duration = Duration::from_secs(30);

fn app_directory(cache: bool) -> Result<PathBuf> {
    let directory = (if cache {
        dirs_next::cache_dir()
    } else {
        dirs_next::data_dir()
    })
    .ok_or_else(|| anyhow!("Application storage is unavailable"))?
    .join("com.github.marknote")
    .join(if cache { "image-cache" } else { "draft-assets" });
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

pub fn write_cache_image(filename: String, data_url: String) -> Result<PathBuf> {
    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| anyhow!("Invalid image data URL"))?;
    if !header.starts_with("data:image/")
        || !header.ends_with(";base64")
        || encoded.len() > 128 * 1024 * 1024
    {
        return Err(anyhow!("Invalid or oversized image data URL"));
    }
    let bytes = general_purpose::STANDARD.decode(encoded)?;
    if header == "data:image/svg+xml;base64" {
        let svg = std::str::from_utf8(&bytes)?;
        let root =
            regex::Regex::new(r"(?s)^\s*(?:<\?xml.*?\?>\s*)?(?:<!--.*?-->\s*)*<svg(?:\s|>)")?;
        if !root.is_match(svg.trim_start_matches('\u{feff}')) {
            return Err(anyhow!("Invalid SVG image"));
        }
    } else {
        image::guess_format(&bytes)?;
    }
    let (path, mut file) = unique_file(&app_directory(true)?, &filename)?;
    let result = file.write_all(&bytes).and_then(|_| file.sync_all());
    drop(file);
    if let Err(error) = result {
        let _ = fs::remove_file(&path);
        return Err(error.into());
    }
    Ok(path)
}

fn copy_unique(source: &Path, directory: &Path) -> Result<PathBuf> {
    fs::create_dir_all(directory)?;
    let (path, mut output) = unique_file(
        directory,
        source
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("image.png"),
    )?;
    let result = (|| -> Result<()> {
        std::io::copy(&mut fs::File::open(source)?, &mut output)?;
        output.sync_all()?;
        Ok(())
    })();
    drop(output);
    if let Err(error) = result {
        let _ = fs::remove_file(&path);
        return Err(error);
    }
    Ok(path)
}

fn absolute_reference(path: &Path) -> String {
    let value = path.to_string_lossy();
    if value.starts_with("\\\\") {
        if let Ok(url) = url::Url::from_file_path(path) {
            return url.to_string();
        }
    }
    value.replace('\\', "/")
}

pub async fn save_image(md_path: Option<String>, image_path: String) -> Result<String> {
    let source = Path::new(&image_path);
    if !source.is_file() {
        return Err(anyhow!("Image file is unavailable"));
    }
    match super::get_save_image_type()? {
        ImageSaveType::Default(configured) => {
            let document = match md_path.filter(|v| !v.is_empty()) {
                Some(path) => PathBuf::from(path),
                None => {
                    return Ok(absolute_reference(&copy_unique(
                        source,
                        &app_directory(false)?,
                    )?))
                }
            };
            let name = document
                .file_name()
                .and_then(|v| v.to_str())
                .ok_or_else(|| anyhow!("Invalid document filename"))?;
            let relative =
                PathBuf::from(configured.unwrap_or_default().replace("${filename}", name));
            if relative.is_absolute() {
                return Err(anyhow!(
                    "The default image directory must be relative to the document"
                ));
            }
            let directory = document.parent().unwrap_or(Path::new(".")).join(&relative);
            let path = copy_unique(source, &directory)?;
            Ok(encode_path(&relative.join(path.file_name().unwrap())))
        }
        ImageSaveType::Sepc(path) => {
            Ok(absolute_reference(&copy_unique(source, Path::new(&path))?))
        }
        ImageSaveType::PicGo(endpoint) => {
            let parsed = url::Url::parse(&endpoint)
                .ok()
                .filter(|url| matches!(url.scheme(), "http" | "https"));
            if let Some(url) = parsed {
                if url.host_str().is_none() {
                    return Err(anyhow!("Invalid PicGo endpoint"));
                }
                let client = reqwest::Client::builder()
                    .connect_timeout(Duration::from_secs(5))
                    .timeout(UPLOAD_TIMEOUT)
                    .build()?;
                let response = client
                    .post(url)
                    .json(&serde_json::json!({"list":[image_path]}))
                    .send()
                    .await?
                    .error_for_status()?;
                let payload: serde_json::Value = response.json().await?;
                parse_picgo_response(&payload)
            } else {
                // Avoid blocking the WebView event loop while the configured executable uploads.
                tauri::async_runtime::spawn_blocking(move || upload_cli(&endpoint, &image_path))
                    .await
                    .map_err(|e| anyhow!(e))?
            }
        }
    }
}

fn checked_url(value: &str) -> Result<String> {
    let url = url::Url::parse(value.trim())?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(anyhow!("PicGo returned an invalid image URL"));
    }
    Ok(url.into())
}

pub(crate) fn parse_picgo_response(payload: &serde_json::Value) -> Result<String> {
    if payload.get("success").and_then(|v| v.as_bool()) != Some(true) {
        return Err(anyhow!("PicGo upload failed"));
    }
    let result = payload
        .get("result")
        .and_then(|v| v.as_array())
        .and_then(|v| v.first())
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("PicGo returned no image URL"))?;
    checked_url(result)
}

fn parse_cli_output(output: &str) -> Result<String> {
    if let Ok(payload) = serde_json::from_str(output.trim()) {
        return parse_picgo_response(&payload);
    }
    // PicGo CLI commonly prints the URL on its own line, optionally preceded by a status label.
    for line in output.lines().rev() {
        let line = line.trim();
        let value = line
            .strip_prefix("[PicGo SUCCESS]:")
            .or_else(|| line.strip_prefix("SUCCESS:"))
            .unwrap_or(line)
            .trim();
        let value = value.trim_matches(|c: char| "\"'[]".contains(c));
        if !value.chars().any(char::is_whitespace)
            && (value.starts_with("https://") || value.starts_with("http://"))
        {
            if let Ok(url) = checked_url(value) {
                return Ok(url);
            }
        }
    }
    Err(anyhow!("PicGo completed without a valid image URL"))
}

fn upload_cli(program: &str, image: &str) -> Result<String> {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command
        .arg("upload")
        .arg(image)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("PicGo output is unavailable"))?;
    // Drain output concurrently so a verbose uploader cannot deadlock against the pipe buffer.
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut output = String::new();
        let result = stdout
            .take(1024 * 1024 + 1)
            .read_to_string(&mut output)
            .map(|_| output);
        let _ = sender.send(result);
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < UPLOAD_TIMEOUT => {
                std::thread::sleep(Duration::from_millis(50))
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(anyhow!("PicGo upload timed out after 30 seconds"));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error.into());
            }
        }
    };
    if !status.success() {
        return Err(anyhow!("PicGo upload failed with exit status {status}"));
    }
    let output = receiver
        .recv_timeout(Duration::from_secs(2))
        .map_err(|_| anyhow!("PicGo output timed out"))??;
    if output.len() > 1024 * 1024 {
        return Err(anyhow!("PicGo output is too large"));
    }
    parse_cli_output(&output)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn uploader_rejects_empty_or_unsafe_results() {
        for payload in [
            serde_json::json!({"success":false,"result":["https://host/image.png"]}),
            serde_json::json!({"success":true,"result":[]}),
            serde_json::json!({"success":true,"result":["file:///secret"]}),
            serde_json::json!({"success":true,"result":[""]}),
        ] {
            assert!(parse_picgo_response(&payload).is_err());
        }
        assert!(parse_cli_output("upload finished").is_err());
        assert!(parse_cli_output("Upload failed at endpoint https://localhost/upload").is_err());
    }
    #[test]
    fn uploader_parses_json_and_cli_urls() {
        assert_eq!(
            parse_picgo_response(
                &serde_json::json!({"success":true,"result":["https://host/image.png"]})
            )
            .unwrap(),
            "https://host/image.png"
        );
        assert_eq!(
            parse_cli_output("[PicGo SUCCESS]: https://host/image.png\n").unwrap(),
            "https://host/image.png"
        );
    }
}
