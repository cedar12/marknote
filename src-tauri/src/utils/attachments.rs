use anyhow::{anyhow, Context, Result};
use serde::Deserialize;
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Deserialize)]
pub struct AttachmentReference {
    pub start: usize,
    pub end: usize,
    pub source: String,
    pub key: String,
    pub prefix: String,
    pub title: Option<String>,
    pub syntax: String,
}

/// Copied assets are retained only after the Markdown save has succeeded.
pub struct AssetStage {
    pub markdown: String,
    pub mapping: HashMap<String, String>,
    created: Vec<PathBuf>,
    created_directory: Option<PathBuf>,
    committed: bool,
}

impl AssetStage {
    pub fn commit(&mut self) {
        self.committed = true;
    }
}

impl Drop for AssetStage {
    fn drop(&mut self) {
        if !self.committed {
            for path in &self.created {
                let _ = fs::remove_file(path);
            }
            if let Some(path) = &self.created_directory {
                let _ = fs::remove_dir(path);
            }
        }
    }
}

pub(crate) fn unique_file(directory: &Path, filename: &str) -> Result<(PathBuf, fs::File)> {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let name = Path::new(filename)
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("image.png");
    // Keep portable names even when an image's supplied filename contains platform-specific punctuation.
    let portable = |value: &str, limit| {
        value
            .chars()
            .map(|c| {
                if c.is_control() || "<>:\"/\\|?*".contains(c) {
                    '_'
                } else {
                    c
                }
            })
            .take(limit)
            .collect::<String>()
    };
    let stem = portable(
        Path::new(name)
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("image"),
        48,
    );
    let extension = portable(
        Path::new(name)
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or(""),
        10,
    );
    let name = if extension.is_empty() {
        stem
    } else {
        format!("{stem}.{extension}")
    };
    let name = if name.trim_matches([' ', '.']).is_empty() {
        "image.png"
    } else {
        &name
    };
    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    for _ in 0..32 {
        let path = directory.join(format!(
            "{time}-{}-{}-{name}",
            std::process::id(),
            SEQUENCE.fetch_add(1, Ordering::Relaxed)
        ));
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(file) => return Ok((path, file)),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(anyhow!("Cannot allocate an attachment filename"))
}

pub(crate) fn encode_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .bytes()
        .map(|byte| {
            if byte.is_ascii_alphanumeric() || b"-._~/".contains(&byte) {
                (byte as char).to_string()
            } else {
                format!("%{byte:02X}")
            }
        })
        .collect()
}

fn resolve_source(source: &str, document: Option<&str>) -> Result<PathBuf> {
    if source.starts_with("file:") {
        return url::Url::parse(source)?
            .to_file_path()
            .map_err(|_| anyhow!("Invalid local attachment URL"));
    }
    let path = PathBuf::from(source);
    if path.is_absolute() {
        return Ok(path);
    }
    let document = document
        .ok_or_else(|| anyhow!("A relative attachment has no source document: {source}"))?;
    Ok(Path::new(document)
        .parent()
        .unwrap_or(Path::new("."))
        .join(path))
}

pub fn stage_save_as_assets(
    target: &Path,
    source: Option<&str>,
    markdown: &str,
    references: &[AttachmentReference],
) -> Result<AssetStage> {
    let mut stage = AssetStage {
        markdown: markdown.into(),
        mapping: HashMap::new(),
        created: vec![],
        created_directory: None,
        committed: false,
    };
    if source
        .map(|source| {
            fs::canonicalize(source).ok() == fs::canonicalize(target).ok() && target.exists()
        })
        .unwrap_or(false)
    {
        return Ok(stage);
    }
    if references.is_empty() {
        return Ok(stage);
    }
    let parent = target.parent().unwrap_or(Path::new("."));
    let directory_name = format!(
        "{}.assets",
        target
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or_else(|| anyhow!("Invalid Markdown filename"))?
    );
    let directory = parent.join(&directory_name);
    match fs::symlink_metadata(&directory) {
        Ok(meta) => {
            // A Windows junction also resolves outside its lexical directory.
            if !meta.is_dir()
                || meta.file_type().is_symlink()
                || fs::canonicalize(&directory)?.parent()
                    != Some(fs::canonicalize(parent)?.as_path())
            {
                return Err(anyhow!(
                    "The attachment directory is not a regular directory"
                ));
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(&directory)?;
            stage.created_directory = Some(directory.clone());
        }
        Err(error) => return Err(error.into()),
    }
    let mut copies: HashMap<PathBuf, String> = HashMap::new();
    let mut output = String::with_capacity(markdown.len());
    let mut previous = 0;
    for reference in references {
        if reference.start < previous
            || reference.end < reference.start
            || reference.end > markdown.len()
            || !markdown.is_char_boundary(reference.start)
            || !markdown.is_char_boundary(reference.end)
            || !matches!(reference.syntax.as_str(), "markdown" | "html")
        {
            return Err(anyhow!("Invalid attachment source range"));
        }
        let text = &markdown[reference.start..reference.end];
        if reference.syntax == "markdown"
            && (!text.starts_with(&reference.prefix)
                || !reference.prefix.starts_with("![")
                || !reference.prefix.ends_with(']'))
        {
            return Err(anyhow!("Invalid Markdown attachment syntax"));
        }
        let original = resolve_source(&reference.source, source)?;
        let original = fs::canonicalize(&original)
            .with_context(|| format!("Cannot read attachment: {}", original.display()))?;
        if !original.is_file() {
            return Err(anyhow!(
                "Attachment is not a regular file: {}",
                original.display()
            ));
        }
        let destination = if let Some(destination) = copies.get(&original) {
            destination.clone()
        } else {
            let name = original
                .file_name()
                .and_then(|v| v.to_str())
                .unwrap_or("image.png");
            let (path, mut file) = unique_file(&directory, name)?;
            stage.created.push(path.clone());
            std::io::copy(&mut fs::File::open(&original)?, &mut file)?;
            file.flush()?;
            file.sync_all()?;
            let relative = encode_path(&Path::new(&directory_name).join(path.file_name().unwrap()));
            copies.insert(original, relative.clone());
            relative
        };
        stage
            .mapping
            .insert(reference.key.clone(), destination.clone());
        stage
            .mapping
            .insert(reference.source.clone(), destination.clone());
        output.push_str(&markdown[previous..reference.start]);
        if reference.syntax == "html" {
            output.push_str(&destination);
        } else {
            output.push_str(&reference.prefix);
            output.push_str("(<");
            output.push_str(&destination);
            output.push('>');
            if let Some(title) = &reference.title {
                output.push_str(" \"");
                output.push_str(&title.replace('\\', "\\\\").replace('"', "\\\""));
                output.push('"');
            }
            output.push(')');
        }
        previous = reference.end;
    }
    output.push_str(&markdown[previous..]);
    stage.markdown = output;
    Ok(stage)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Directory(PathBuf);
    impl Directory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "marknote-assets-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Directory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn reference(start: usize, end: usize) -> AttachmentReference {
        AttachmentReference {
            start,
            end,
            source: "图片.png".into(),
            key: "%E5%9B%BE%E7%89%87.png".into(),
            prefix: "![图]".into(),
            title: None,
            syntax: "markdown".into(),
        }
    }
    #[test]
    fn save_as_copies_once_preserves_source_and_unicode() {
        let dir = Directory::new();
        fs::write(dir.0.join("图片.png"), b"asset").unwrap();
        let markdown = "前文\n![图](图片.png)\n![图](图片.png)";
        let first = markdown.find("![").unwrap();
        let end = markdown[first..].find(')').unwrap() + first + 1;
        let second = end + 1;
        let mut stage = stage_save_as_assets(
            &dir.0.join("copy.md"),
            Some(dir.0.join("original.md").to_str().unwrap()),
            markdown,
            &[reference(first, end), reference(second, markdown.len())],
        )
        .unwrap();
        assert!(stage.markdown.starts_with("前文\n![图](<copy.md.assets/"));
        assert_eq!(stage.created.len(), 1);
        assert_eq!(fs::read(dir.0.join("图片.png")).unwrap(), b"asset");
        let path = stage.created[0].clone();
        stage.commit();
        drop(stage);
        assert!(path.exists());
    }
    #[test]
    fn aborted_save_removes_only_new_assets() {
        let dir = Directory::new();
        fs::write(dir.0.join("图片.png"), b"asset").unwrap();
        fs::create_dir(dir.0.join("copy.md.assets")).unwrap();
        fs::write(dir.0.join("copy.md.assets/keep"), b"keep").unwrap();
        let markdown = "![图](图片.png)";
        let stage = stage_save_as_assets(
            &dir.0.join("copy.md"),
            Some(dir.0.join("original.md").to_str().unwrap()),
            markdown,
            &[reference(0, markdown.len())],
        )
        .unwrap();
        let path = stage.created[0].clone();
        drop(stage);
        assert!(!path.exists());
        assert_eq!(
            fs::read(dir.0.join("copy.md.assets/keep")).unwrap(),
            b"keep"
        );
    }
    #[test]
    fn missing_assets_and_invalid_ranges_leave_no_copies() {
        let dir = Directory::new();
        let markdown = "![图](图片.png)";
        assert!(stage_save_as_assets(
            &dir.0.join("copy.md"),
            Some(dir.0.join("original.md").to_str().unwrap()),
            markdown,
            &[reference(0, markdown.len())]
        )
        .is_err());
        assert!(!dir.0.join("copy.md.assets").exists());
        fs::write(dir.0.join("图片.png"), b"asset").unwrap();
        assert!(stage_save_as_assets(
            &dir.0.join("copy.md"),
            None,
            markdown,
            &[reference(1, markdown.len())]
        )
        .is_err());
    }
    #[test]
    fn unique_allocations_never_replace_existing_images() {
        let dir = Directory::new();
        let (first, _) = unique_file(&dir.0, "../photo.png").unwrap();
        let (second, _) = unique_file(&dir.0, "../photo.png").unwrap();
        assert_ne!(first, second);
        assert_eq!(first.parent(), Some(dir.0.as_path()));
    }
}
