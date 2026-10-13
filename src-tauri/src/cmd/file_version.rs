//! Conditional Markdown writes. Every window shares the canonical-path lock.
use std::{collections::HashMap, fs::{self, File, OpenOptions}, io::{Read, Write}, path::{Path, PathBuf}, sync::{Arc, Mutex, Weak}, time::{SystemTime, UNIX_EPOCH}};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, WebviewWindow};

lazy_static! { static ref LOCKS: Mutex<HashMap<PathBuf, Weak<Mutex<()>>>> = Mutex::new(HashMap::new()); }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileVersion {
    pub exists: bool,
    pub mtime_ns: String,
    pub size: u64,
    pub hash: String,
}

impl FileVersion {
    fn absent() -> Self { Self { exists: false, mtime_ns: "0".into(), size: 0, hash: String::new() } }
    fn same_contents(&self, other: &Self) -> bool {
        self.exists == other.exists && self.size == other.size && self.hash == other.hash
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownResponse {
    pub code: u16,
    pub info: String,
    pub data: Option<String>,
    pub version: Option<FileVersion>,
    pub canonical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachment_mapping: Option<HashMap<String, String>>,
}

impl MarkdownResponse {
    pub fn error(error: impl ToString) -> Self {
        Self { code: 1, info: error.to_string(), data: None, version: None, canonical_path: None, attachment_mapping: None }
    }
    fn response(code: u16, path: &str, canonical: &Path, data: Option<String>, version: FileVersion) -> Self {
        Self { code, info: path.into(), canonical_path: Some(canonical.to_string_lossy().into_owned()), data, version: Some(version), attachment_mapping: None }
    }
}

pub fn canonical_target(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path);
    match fs::canonicalize(path) {
        Ok(path) => Ok(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let parent = path.parent().filter(|parent| !parent.as_os_str().is_empty()).unwrap_or_else(|| Path::new("."));
            let name = path.file_name().ok_or("invalid_file_path")?;
            Ok(fs::canonicalize(parent).map_err(|error| error.to_string())?.join(name))
        },
        Err(error) => Err(error.to_string()),
    }
}

fn path_identity(path: &Path) -> PathBuf {
    #[cfg(windows)] { PathBuf::from(path.to_string_lossy().to_lowercase()) }
    #[cfg(not(windows))] { path.to_path_buf() }
}

pub fn same_canonical_target(left: &Path, right: &Path) -> bool {
    path_identity(left) == path_identity(right)
}

fn path_lock(path: &Path) -> Result<Arc<Mutex<()>>, String> {
    let key = path_identity(path);
    let mut locks = LOCKS.lock().map_err(|error| error.to_string())?;
    locks.retain(|_, lock| lock.strong_count() > 0);
    if let Some(lock) = locks.get(&key).and_then(Weak::upgrade) { return Ok(lock); }
    let lock = Arc::new(Mutex::new(()));
    locks.insert(key, Arc::downgrade(&lock));
    Ok(lock)
}

fn stamp(metadata: &fs::Metadata) -> String {
    metadata.modified().ok().and_then(|time| time.duration_since(UNIX_EPOCH).ok()).map(|time| time.as_nanos().to_string()).unwrap_or_else(|| "0".into())
}

fn read_snapshot(path: &Path, include_content: bool) -> Result<(FileVersion, Option<Vec<u8>>), String> {
    for _ in 0..3 {
        let mut file = match File::open(path) {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok((FileVersion::absent(), None)),
            Err(error) => return Err(error.to_string()),
        };
        let before = file.metadata().map_err(|error| error.to_string())?;
        if !before.is_file() { return Err("save_path_is_not_a_file".into()); }
        let mut hash = Sha256::new();
        let mut content = include_content.then(Vec::new);
        let mut buffer = [0u8; 65536];
        let mut size = 0u64;
        loop {
            let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
            if read == 0 { break; }
            hash.update(&buffer[..read]);
            size += read as u64;
            if let Some(content) = content.as_mut() { content.extend_from_slice(&buffer[..read]); }
        }
        let after = match fs::metadata(path) { Ok(metadata) => metadata, Err(_) => continue };
        if before.len() == size && after.len() == size && stamp(&before) == stamp(&after) {
            return Ok((FileVersion { exists: true, mtime_ns: stamp(&after), size, hash: format!("{:x}", hash.finalize()) }, content));
        }
    }
    Err("file_changed_during_read".into())
}

pub fn read_markdown(path: &str) -> Result<MarkdownResponse, String> {
    let canonical = canonical_target(path)?;
    let lock = path_lock(&canonical)?;
    let _guard = lock.lock().map_err(|error| error.to_string())?;
    let (version, bytes) = read_snapshot(&canonical, true)?;
    let content = String::from_utf8(bytes.ok_or("file_not_found")?).map_err(|error| error.to_string())?;
    Ok(MarkdownResponse::response(0, path, &canonical, Some(content), version))
}

pub fn save_markdown_checked(path: &str, markdown: &str, expected: Option<&FileVersion>) -> Result<MarkdownResponse, String> {
    save_checked_inner(path, markdown, expected, || {})
}

fn save_checked_inner(path: &str, markdown: &str, expected: Option<&FileVersion>, before_commit: impl FnOnce()) -> Result<MarkdownResponse, String> {
    let canonical = canonical_target(path)?;
    let lock = path_lock(&canonical)?;
    let _guard = lock.lock().map_err(|error| error.to_string())?;
    let (actual, _) = read_snapshot(&canonical, false)?;
    // Missing baseline is never permission to overwrite. Explicit overwrite also
    // supplies the disk version the user approved, so a subsequent edit still wins.
    if !expected.map(|expected| expected.same_contents(&actual)).unwrap_or(false) {
        return Ok(MarkdownResponse::response(409, path, &canonical, None, actual));
    }
    let parent = canonical.parent().ok_or("invalid_file_path")?;
    let name = canonical.file_name().ok_or("invalid_file_path")?.to_string_lossy();
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_nanos();
    let temporary = parent.join(format!(".{name}.{}-{nonce}.tmp", std::process::id()));
    let backup = parent.join(format!(".{name}.{}-{nonce}.bak", std::process::id()));
    let mut owns_temporary = false;
    let result = (|| {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|error| error.to_string())?;
        owns_temporary = true;
        file.write_all(markdown.as_bytes()).and_then(|_| file.sync_all()).map_err(|error| error.to_string())?;
        let metadata = file.metadata().map_err(|error| error.to_string())?;
        let written = FileVersion { exists: true, mtime_ns: stamp(&metadata), size: markdown.len() as u64,
            hash: format!("{:x}", Sha256::digest(markdown.as_bytes())) };
        drop(file);
        before_commit();
        // A slow staging write must not hide an external edit made after the first check.
        let (latest, _) = read_snapshot(&canonical, false)?;
        if !expected.map(|expected| expected.same_contents(&latest)).unwrap_or(false) {
            return Ok(MarkdownResponse::response(409, path, &canonical, None, latest));
        }
        if latest.exists {
            fs::rename(&canonical, &backup).map_err(|error| error.to_string())?;
            if let Err(error) = fs::rename(&temporary, &canonical) {
                if let Err(restore) = fs::rename(&backup, &canonical) { log::error!("File replacement and backup restore failed: {error}; {restore}"); }
                return Err(error.to_string());
            }
            if let Err(error) = fs::remove_file(&backup) { log::warn!("Could not remove file save backup: {error}"); }
        } else { fs::rename(&temporary, &canonical).map_err(|error| error.to_string())?; }
        Ok(MarkdownResponse::response(0, path, &canonical, None, written))
    })();
    if owns_temporary && temporary.exists() { let _ = fs::remove_file(&temporary); }
    result
}

#[tauri::command(async)]
pub fn probe_file_version(path: String, baseline: Option<FileVersion>, full: Option<bool>) -> Result<MarkdownResponse, String> {
    let canonical = canonical_target(&path)?;
    let lock = path_lock(&canonical)?;
    let _guard = lock.lock().map_err(|error| error.to_string())?;
    if full != Some(true) {
        if let (Some(baseline), Ok(metadata)) = (baseline.as_ref(), fs::metadata(&canonical)) {
            if baseline.exists && metadata.is_file() && metadata.len() == baseline.size && stamp(&metadata) == baseline.mtime_ns {
                return Ok(MarkdownResponse::response(0, &path, &canonical, None, baseline.clone()));
            }
        }
    }
    let (version, _) = read_snapshot(&canonical, false)?;
    Ok(MarkdownResponse::response(0, &path, &canonical, None, version))
}

pub fn emit_saved(app: &AppHandle, window: &WebviewWindow, response: &MarkdownResponse) {
    if response.code != 0 { return; }
    #[derive(Clone, Serialize)] #[serde(rename_all = "camelCase")]
    struct Saved<'a> { source_window: &'a str, canonical_path: &'a Option<String>, version: &'a Option<FileVersion> }
    if let Err(error) = app.emit("marknote-file-saved", Saved { source_window: window.label(), canonical_path: &response.canonical_path, version: &response.version }) {
        log::warn!("File saved but cross-window notification failed: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;
    struct Directory(PathBuf);
    impl Drop for Directory { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
    fn fixture() -> (Directory, String) {
        let dir = std::env::temp_dir().join(format!("marknote-file-version-{}-{}", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir(&dir).unwrap();
        let path = dir.join("note.md"); fs::write(&path, "original").unwrap();
        (Directory(dir), path.to_string_lossy().into_owned())
    }
    #[test]
    fn external_edit_and_missing_baseline_never_overwrite() {
        let (_directory, path) = fixture();
        let baseline = read_markdown(&path).unwrap().version.unwrap();
        fs::write(&path, "external").unwrap();
        assert_eq!(save_markdown_checked(&path, "local", Some(&baseline)).unwrap().code, 409);
        assert_eq!(save_markdown_checked(&path, "local", None).unwrap().code, 409);
        assert_eq!(fs::read_to_string(&path).unwrap(), "external");
    }
    #[test]
    fn approved_overwrite_and_recreation_are_still_conditional() {
        let (_directory, path) = fixture();
        let baseline = read_markdown(&path).unwrap().version.unwrap();
        assert_eq!(save_markdown_checked(&path, "first", Some(&baseline)).unwrap().code, 0);
        let observed = read_markdown(&path).unwrap().version.unwrap();
        fs::write(&path, "changed again").unwrap();
        assert_eq!(save_markdown_checked(&path, "approved", Some(&observed)).unwrap().code, 409);
        fs::remove_file(&path).unwrap();
        assert_eq!(save_markdown_checked(&path, "local", Some(&baseline)).unwrap().code, 409);
        assert_eq!(save_markdown_checked(&path, "recreated", Some(&FileVersion::absent())).unwrap().code, 0);
    }
    #[test]
    fn two_windows_with_the_same_baseline_have_one_winner() {
        let (_directory, path) = fixture();
        let baseline = read_markdown(&path).unwrap().version.unwrap();
        let barrier = Arc::new(Barrier::new(3));
        let mut threads = Vec::new();
        for text in ["first window", "second window"] {
            let (path, baseline, barrier) = (path.clone(), baseline.clone(), barrier.clone());
            threads.push(std::thread::spawn(move || { barrier.wait(); save_markdown_checked(&path, text, Some(&baseline)).unwrap().code }));
        }
        barrier.wait();
        let mut codes: Vec<_> = threads.into_iter().map(|thread| thread.join().unwrap()).collect(); codes.sort();
        assert_eq!(codes, vec![0, 409]);
        assert_eq!(fs::read_dir(Path::new(&path).parent().unwrap()).unwrap().count(), 1);
    }
    #[test]
    fn sha256_baseline_is_bound_to_the_read_content() {
        let (_directory, path) = fixture();
        fs::write(&path, "abc").unwrap();
        let response = read_markdown(&path).unwrap();
        assert_eq!(response.data.as_deref(), Some("abc"));
        assert_eq!(response.version.unwrap().hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
    #[test]
    fn external_edit_during_staging_is_preserved() {
        let (_directory, path) = fixture();
        let baseline = read_markdown(&path).unwrap().version.unwrap();
        let response = save_checked_inner(&path, "local", Some(&baseline), || fs::write(&path, "external during staging").unwrap()).unwrap();
        assert_eq!(response.code, 409);
        assert_eq!(fs::read_to_string(&path).unwrap(), "external during staging");
        assert_eq!(fs::read_dir(Path::new(&path).parent().unwrap()).unwrap().count(), 1);
    }
}
