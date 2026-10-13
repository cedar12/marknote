//! Local-only recovery snapshots. Draft IDs are independent of document paths and
//! window labels; recovery never writes to a user's original Markdown file.
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, WebviewWindow};

const MAX_MARKDOWN_BYTES: usize = 128 * 1024 * 1024;
const MAX_JSON_BYTES: u64 = 768 * 1024 * 1024 + 65536;
const LEASE_MS: u64 = 20_000;
static FILES: Mutex<()> = Mutex::new(());
static HEARTBEAT_STARTED: AtomicBool = AtomicBool::new(false);
lazy_static! {
    static ref SESSIONS: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
    static ref SUMMARIES: Mutex<HashMap<PathBuf, (u64, Option<SystemTime>, DraftMetadata)>> =
        Mutex::new(HashMap::new());
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DraftSnapshot {
    schema_version: u8,
    id: String,
    owner: String,
    title: String,
    source_path: Option<String>,
    markdown: String,
    updated_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftSummary {
    id: String,
    title: String,
    source_path: Option<String>,
    updated_at: u64,
    bytes: usize,
}

#[derive(Clone)]
struct DraftMetadata {
    summary: DraftSummary,
    owner: String,
}

fn metadata_for(draft: &DraftSnapshot) -> DraftMetadata {
    DraftMetadata {
        summary: DraftSummary {
            id: draft.id.clone(),
            title: draft.title.clone(),
            source_path: draft.source_path.clone(),
            updated_at: draft.updated_at,
            bytes: draft.markdown.len(),
        },
        owner: draft.owner.clone(),
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn lease_is_active(expires: Option<u64>, modified: Option<SystemTime>, now: SystemTime) -> bool {
    let now_ms = now
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    expires.map(|expires| expires > now_ms).unwrap_or(false)
        || modified
            .and_then(|modified| now.duration_since(modified).ok())
            .map(|age| age < Duration::from_millis(LEASE_MS))
            .unwrap_or(false)
}

fn valid_id(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(index, value)| {
            if [8, 13, 18, 23].contains(&index) {
                value == b'-'
            } else {
                value.is_ascii_digit() || (b'a'..=b'f').contains(&value)
            }
        })
}

fn validate(draft: &DraftSnapshot) -> Result<(), String> {
    if draft.schema_version != 1
        || !valid_id(&draft.id)
        || !valid_id(&draft.owner)
        || draft.title.chars().count() > 1024
        || draft
            .source_path
            .as_ref()
            .map(|path| path.chars().count() > 32768)
            .unwrap_or(false)
        || draft.markdown.len() > MAX_MARKDOWN_BYTES
        || draft.updated_at == 0
    {
        return Err("invalid_draft".into());
    }
    Ok(())
}

fn is_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_type().is_symlink() || metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        metadata.file_type().is_symlink()
    }
}

struct DraftFiles {
    directory: PathBuf,
}
impl DraftFiles {
    fn for_app(app: &AppHandle) -> Result<Self, String> {
        Ok(Self {
            directory: app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?
                .join("drafts"),
        })
    }
    fn prepare(&self) -> Result<(), String> {
        if !self.exists()? {
            let parent = self.directory.parent().ok_or("invalid_draft_directory")?;
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            match fs::create_dir(&self.directory) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(error) => return Err(error.to_string()),
            }
        }
        self.exists()?;
        Ok(())
    }
    fn exists(&self) -> Result<bool, String> {
        match fs::symlink_metadata(&self.directory) {
            Ok(metadata) if metadata.is_dir() && !is_link(&metadata) => Ok(true),
            Ok(_) => Err("unsafe_draft_directory".into()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(error.to_string()),
        }
    }
    fn check_file(&self, path: &Path) -> Result<fs::Metadata, String> {
        if path.parent() != Some(self.directory.as_path()) {
            return Err("unsafe_draft_path".into());
        }
        let metadata = fs::symlink_metadata(path).map_err(|error| error.to_string())?;
        if !metadata.is_file() || is_link(&metadata) {
            return Err("unsafe_draft_path".into());
        }
        let root = fs::canonicalize(&self.directory).map_err(|error| error.to_string())?;
        if fs::canonicalize(path)
            .map_err(|error| error.to_string())?
            .parent()
            != Some(root.as_path())
        {
            return Err("unsafe_draft_path".into());
        }
        Ok(metadata)
    }
    fn snapshot_name(path: &Path) -> Option<(String, u128)> {
        let name = path
            .file_name()?
            .to_str()?
            .strip_prefix("draft-")?
            .strip_suffix(".json")?;
        if name.len() < 38 {
            return None;
        }
        let id = name.get(..36)?;
        if !valid_id(id) || name.as_bytes().get(36) != Some(&b'-') {
            return None;
        }
        Some((id.into(), name.get(37..)?.parse().ok()?))
    }
    fn paths(&self) -> Result<Vec<PathBuf>, String> {
        if !self.exists()? {
            return Ok(Vec::new());
        }
        fs::read_dir(&self.directory)
            .map_err(|error| error.to_string())?
            .map(|entry| {
                entry
                    .map(|entry| entry.path())
                    .map_err(|error| error.to_string())
            })
            .collect()
    }
    fn read(&self, path: &Path, expected_id: &str) -> Result<DraftSnapshot, String> {
        if self.check_file(path)?.len() > MAX_JSON_BYTES {
            return Err("draft_too_large".into());
        }
        let mut json = String::new();
        File::open(path)
            .map_err(|error| error.to_string())?
            .take(MAX_JSON_BYTES + 1)
            .read_to_string(&mut json)
            .map_err(|error| error.to_string())?;
        if json.len() as u64 > MAX_JSON_BYTES {
            return Err("draft_too_large".into());
        }
        let draft: DraftSnapshot =
            serde_json::from_str(&json).map_err(|error| error.to_string())?;
        validate(&draft)?;
        if draft.id != expected_id {
            return Err("invalid_draft_identity".into());
        }
        Ok(draft)
    }
    fn latest(&self) -> Result<BTreeMap<String, DraftSnapshot>, String> {
        let mut drafts = BTreeMap::<String, (u128, DraftSnapshot)>::new();
        for path in self.paths()? {
            if let Some((id, stamp)) = Self::snapshot_name(&path) {
                match self.read(&path, &id) {
                    Ok(draft) if drafts.get(&id).map(|(old, _)| stamp > *old).unwrap_or(true) => {
                        drafts.insert(id, (stamp, draft));
                    }
                    Ok(_) => {}
                    // Interrupted new writes never hide the previous valid snapshot.
                    Err(error) => {
                        log::warn!("Ignoring an incomplete or unsafe local draft: {error}")
                    }
                }
            }
        }
        Ok(drafts
            .into_iter()
            .map(|(id, (_, draft))| (id, draft))
            .collect())
    }
    fn latest_metadata(
        &self,
        only_id: Option<&str>,
    ) -> Result<BTreeMap<String, DraftMetadata>, String> {
        let mut drafts = BTreeMap::<String, (u128, DraftMetadata)>::new();
        for path in self.paths()? {
            let (id, stamp) = match Self::snapshot_name(&path) {
                Some(value) => value,
                None => continue,
            };
            if only_id.map(|only| only != id).unwrap_or(false)
                || drafts
                    .get(&id)
                    .map(|(old, _)| stamp <= *old)
                    .unwrap_or(false)
            {
                continue;
            }
            let metadata = match self.check_file(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            let signature = (metadata.len(), metadata.modified().ok());
            let cached = SUMMARIES
                .lock()
                .map_err(|error| error.to_string())?
                .get(&path)
                .filter(|(size, modified, _)| (*size, *modified) == signature)
                .map(|(_, _, value)| value.clone());
            let summary = match cached {
                Some(summary) => summary,
                None => match self.read(&path, &id) {
                    Ok(draft) => {
                        let summary = metadata_for(&draft);
                        SUMMARIES
                            .lock()
                            .map_err(|error| error.to_string())?
                            .insert(path, (signature.0, signature.1, summary.clone()));
                        summary
                    }
                    Err(error) => {
                        log::warn!("Ignoring an incomplete or unsafe local draft: {error}");
                        continue;
                    }
                },
            };
            drafts.insert(id, (stamp, summary));
        }
        Ok(drafts
            .into_iter()
            .map(|(id, (_, summary))| (id, summary))
            .collect())
    }
    fn read_latest(&self, id: &str) -> Result<DraftSnapshot, String> {
        if !valid_id(id) {
            return Err("invalid_draft_id".into());
        }
        let mut paths: Vec<_> = self
            .paths()?
            .into_iter()
            .filter_map(|path| {
                Self::snapshot_name(&path)
                    .filter(|(file_id, _)| file_id == id)
                    .map(|(_, stamp)| (stamp, path))
            })
            .collect();
        paths.sort_by(|a, b| b.0.cmp(&a.0));
        for (_, path) in paths {
            if let Ok(draft) = self.read(&path, id) {
                return Ok(draft);
            }
        }
        Err("draft_not_found".into())
    }
    fn append(&self, draft: &DraftSnapshot) -> Result<(), String> {
        validate(draft)?;
        self.prepare()?;
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        let destination = self
            .directory
            .join(format!("draft-{}-{stamp}.json", draft.id));
        let json = serde_json::to_vec(draft).map_err(|error| error.to_string())?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
            .map_err(|error| error.to_string())?;
        if let Err(error) = file.write_all(&json).and_then(|_| file.sync_all()) {
            drop(file);
            let _ = fs::remove_file(&destination);
            return Err(error.to_string());
        }
        drop(file);
        let metadata = self.check_file(&destination)?;
        SUMMARIES.lock().map_err(|error| error.to_string())?.insert(
            destination.clone(),
            (
                metadata.len(),
                metadata.modified().ok(),
                metadata_for(draft),
            ),
        );
        // New immutable files are synced before pruning old revisions. A crash
        // while writing/pruning leaves either this snapshot or its predecessor.
        for path in self.paths()? {
            if path != destination
                && Self::snapshot_name(&path)
                    .map(|(id, _)| id == draft.id)
                    .unwrap_or(false)
            {
                if self.check_file(&path).is_ok() {
                    match fs::remove_file(&path) {
                        Ok(()) => {
                            SUMMARIES
                                .lock()
                                .map_err(|error| error.to_string())?
                                .remove(&path);
                        }
                        Err(error) => log::warn!("Could not prune an older local draft: {error}"),
                    }
                }
            }
        }
        Ok(())
    }
    fn remove(&self, id: &str) -> Result<(), String> {
        if !valid_id(id) {
            return Err("invalid_draft_id".into());
        }
        for path in self.paths()? {
            if Self::snapshot_name(&path)
                .map(|(file_id, _)| file_id == id)
                .unwrap_or(false)
            {
                self.check_file(&path)?;
                fs::remove_file(&path).map_err(|error| error.to_string())?;
                SUMMARIES
                    .lock()
                    .map_err(|error| error.to_string())?
                    .remove(&path);
            }
        }
        Ok(())
    }
    fn lease_path(&self, owner: &str) -> PathBuf {
        self.directory.join(format!("owner-{owner}.lease"))
    }
    fn heartbeat(&self, owner: &str) -> Result<(), String> {
        self.prepare()?;
        let path = self.lease_path(owner);
        match fs::symlink_metadata(&path) {
            Ok(_) => {
                self.check_file(&path)?;
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.to_string()),
        }
        // The in-process registry is authoritative for native windows. The disk
        // lease additionally protects windows belonging to another app process.
        fs::write(path, (now_ms() + LEASE_MS).to_string()).map_err(|error| error.to_string())
    }
    fn active(&self, owner: &str, app: &AppHandle) -> bool {
        if SESSIONS
            .lock()
            .ok()
            .and_then(|sessions| sessions.get(owner).cloned())
            .map(|label| app.get_webview_window(&label).is_some())
            .unwrap_or(false)
        {
            return true;
        }
        let path = self.lease_path(owner);
        let metadata = match self.check_file(&path) {
            Ok(metadata) => metadata,
            Err(_) => return false,
        };
        let expires = if metadata.len() <= 32 {
            fs::read_to_string(&path)
                .ok()
                .and_then(|value| value.parse::<u64>().ok())
        } else {
            None
        };
        // A heartbeat is rewritten in place. Another process can observe its
        // transient empty/partial bytes; recent metadata still means busy.
        // An interrupted process remains protected only until this grace expires.
        lease_is_active(expires, metadata.modified().ok(), SystemTime::now())
    }
    fn record_lock(&self, id: &str, owner: &str, app: &AppHandle) -> Result<RecordLock, String> {
        if !valid_id(id) {
            return Err("invalid_draft_id".into());
        }
        self.prepare()?;
        let path = self.directory.join(format!("draft-{id}.lock"));
        for _ in 0..2 {
            match OpenOptions::new().write(true).create_new(true).open(&path) {
                Ok(mut file) => {
                    let guard = RecordLock { path: path.clone() };
                    file.write_all(owner.as_bytes())
                        .map_err(|error| error.to_string())?;
                    return Ok(guard);
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    let metadata = self.check_file(&path)?;
                    let age = metadata
                        .modified()
                        .ok()
                        .and_then(|time| time.elapsed().ok())
                        .unwrap_or_default();
                    let previous = if metadata.len() <= 36 {
                        fs::read_to_string(&path).unwrap_or_default()
                    } else {
                        String::new()
                    };
                    if age < Duration::from_millis(LEASE_MS)
                        || (valid_id(&previous) && self.active(&previous, app))
                    {
                        return Err("draft_in_use".into());
                    }
                    fs::remove_file(&path).map_err(|error| error.to_string())?;
                }
                Err(error) => return Err(error.to_string()),
            }
        }
        Err("draft_in_use".into())
    }
}

struct RecordLock {
    path: PathBuf,
}
impl Drop for RecordLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn check_owner(owner: &str, window: &WebviewWindow) -> Result<(), String> {
    if !valid_id(owner)
        || SESSIONS
            .lock()
            .map_err(|error| error.to_string())?
            .get(owner)
            .map(String::as_str)
            != Some(window.label())
    {
        return Err("invalid_draft_owner".into());
    }
    Ok(())
}

#[tauri::command(async)]
pub fn draft_register(app: AppHandle, window: WebviewWindow, owner: String) -> Result<(), String> {
    if !valid_id(&owner) || window.label() == "preferences" || window.label() == "about" {
        return Err("invalid_draft_owner".into());
    }
    let _files = FILES.lock().map_err(|error| error.to_string())?;
    let files = DraftFiles::for_app(&app)?;
    files.heartbeat(&owner)?;
    let mut sessions = SESSIONS.lock().map_err(|error| error.to_string())?;
    let previous: Vec<String> = sessions
        .iter()
        .filter(|(_, label)| label.as_str() == window.label())
        .map(|(owner, _)| owner.clone())
        .collect();
    for previous in previous {
        sessions.remove(&previous);
        let path = files.lease_path(&previous);
        if files.check_file(&path).is_ok() {
            let _ = fs::remove_file(path);
        }
    }
    sessions.insert(owner, window.label().into());
    drop(sessions);
    if !HEARTBEAT_STARTED.swap(true, Ordering::SeqCst) {
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(5));
            let sessions = SESSIONS
                .lock()
                .map(|sessions| sessions.clone())
                .unwrap_or_default();
            // Owner files are separate from document snapshots. A slow large
            // snapshot must never hold up leases and make an active process
            // appear dead to another process recovering the same draft.
            if let Ok(files) = DraftFiles::for_app(&app) {
                for (owner, label) in sessions {
                    if app.get_webview_window(&label).is_some() {
                        if let Err(error) = files.heartbeat(&owner) {
                            log::warn!("Draft owner heartbeat failed: {error}");
                        }
                    } else if files.check_file(&files.lease_path(&owner)).is_ok() {
                        let _ = fs::remove_file(files.lease_path(&owner));
                        if let Ok(mut sessions) = SESSIONS.lock() {
                            sessions.remove(&owner);
                        }
                    }
                }
            }
        });
    }
    Ok(())
}

#[tauri::command(async)]
pub fn draft_list(app: AppHandle) -> Result<Vec<DraftSummary>, String> {
    let _files = FILES.lock().map_err(|error| error.to_string())?;
    let files = DraftFiles::for_app(&app)?;
    let mut drafts: Vec<_> = files
        .latest_metadata(None)?
        .into_values()
        .filter(|draft| !files.active(&draft.owner, &app))
        .map(|draft| draft.summary)
        .collect();
    drafts.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(drafts)
}

#[tauri::command(async)]
pub fn draft_write(
    app: AppHandle,
    window: WebviewWindow,
    mut draft: DraftSnapshot,
) -> Result<(), String> {
    validate(&draft)?;
    check_owner(&draft.owner, &window)?;
    let _files = FILES.lock().map_err(|error| error.to_string())?;
    let files = DraftFiles::for_app(&app)?;
    let _record = files.record_lock(&draft.id, &draft.owner, &app)?;
    if files
        .latest_metadata(Some(&draft.id))?
        .get(&draft.id)
        .map(|old| old.owner != draft.owner)
        .unwrap_or(false)
    {
        return Err("draft_in_use".into());
    }
    draft.updated_at = now_ms();
    files.append(&draft)
}

#[tauri::command(async)]
pub fn draft_claim(
    app: AppHandle,
    window: WebviewWindow,
    id: String,
    owner: String,
) -> Result<DraftSnapshot, String> {
    check_owner(&owner, &window)?;
    let _files = FILES.lock().map_err(|error| error.to_string())?;
    let files = DraftFiles::for_app(&app)?;
    let _record = files.record_lock(&id, &owner, &app)?;
    let mut draft = files.read_latest(&id)?;
    if draft.owner != owner && files.active(&draft.owner, &app) {
        return Err("draft_in_use".into());
    }
    draft.owner = owner;
    draft.updated_at = now_ms();
    files.append(&draft)?;
    Ok(draft)
}

#[tauri::command(async)]
pub fn draft_remove(
    app: AppHandle,
    window: WebviewWindow,
    id: String,
    owner: String,
) -> Result<(), String> {
    check_owner(&owner, &window)?;
    let _files = FILES.lock().map_err(|error| error.to_string())?;
    let files = DraftFiles::for_app(&app)?;
    let _record = files.record_lock(&id, &owner, &app)?;
    if let Some(draft) = files.latest_metadata(Some(&id))?.get(&id) {
        if draft.owner != owner && files.active(&draft.owner, &app) {
            return Err("draft_in_use".into());
        }
    }
    files.remove(&id)
}

#[cfg(test)]
mod tests {
    use super::*;
    struct TempDir(PathBuf);
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn fixture() -> (TempDir, DraftFiles, DraftSnapshot) {
        let directory = std::env::temp_dir().join(format!(
            "marknote-drafts-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&directory).unwrap();
        let files = DraftFiles {
            directory: directory.join("drafts"),
        };
        let draft = DraftSnapshot {
            schema_version: 1,
            id: "11111111-1111-4111-8111-111111111111".into(),
            owner: "22222222-2222-4222-8222-222222222222".into(),
            title: "Note.md".into(),
            source_path: Some("C:\\notes\\Note.md".into()),
            markdown: "# Draft\r\n\r\n未保存 📝\r\n".into(),
            updated_at: now_ms(),
        };
        (TempDir(directory), files, draft)
    }
    #[test]
    fn roundtrip_large_unicode_document_and_prune_only_own_snapshots() {
        let (_temp, files, mut draft) = fixture();
        draft.markdown = draft.markdown.repeat(50_000);
        files.append(&draft).unwrap();
        let mut other = draft.clone();
        other.id = "33333333-3333-4333-8333-333333333333".into();
        files.append(&other).unwrap();
        draft.markdown.push_str("Last edit\n");
        files.append(&draft).unwrap();
        assert_eq!(
            files.latest().unwrap().get(&draft.id).unwrap().markdown,
            draft.markdown
        );
        files.remove(&draft.id).unwrap();
        assert_eq!(files.latest().unwrap().len(), 1);
        assert!(files.latest().unwrap().contains_key(&other.id));
    }
    #[test]
    fn interrupted_write_keeps_previous_valid_draft() {
        let (_temp, files, draft) = fixture();
        files.append(&draft).unwrap();
        fs::write(
            files
                .directory
                .join(format!("draft-{}-{}.json", draft.id, u128::MAX)),
            "{partial",
        )
        .unwrap();
        assert_eq!(
            files.latest().unwrap().get(&draft.id).unwrap().markdown,
            draft.markdown
        );
    }
    #[test]
    fn rejects_traversal_and_mismatched_identity() {
        let (_temp, files, mut draft) = fixture();
        assert!(!valid_id("../outside"));
        assert!(files.remove("../outside").is_err());
        files.append(&draft).unwrap();
        let path = files.paths().unwrap().pop().unwrap();
        assert!(files
            .read(&path, "33333333-3333-4333-8333-333333333333")
            .is_err());
        draft.id = "../outside".into();
        assert!(files.append(&draft).is_err());
    }
    #[test]
    fn recent_partial_lease_never_exposes_an_active_window() {
        let now = SystemTime::now();
        assert!(
            lease_is_active(None, Some(now), now),
            "truncated empty heartbeat stays active"
        );
        assert!(
            lease_is_active(Some(17), Some(now), now),
            "partially written numeric heartbeat stays active"
        );
        let old = now - Duration::from_millis(LEASE_MS + 1);
        assert!(
            !lease_is_active(None, Some(old), now),
            "crashed process lease eventually expires"
        );
        assert!(!lease_is_active(Some(17), Some(old), now));
    }
    #[test]
    fn metadata_cache_tracks_immutable_revisions_and_content_identity() {
        let (_temp, files, mut draft) = fixture();
        files.append(&draft).unwrap();
        assert_eq!(
            files
                .latest_metadata(Some(&draft.id))
                .unwrap()
                .get(&draft.id)
                .unwrap()
                .summary
                .bytes,
            draft.markdown.len()
        );
        draft.markdown.push_str("latest\n");
        files.append(&draft).unwrap();
        assert_eq!(
            files.read_latest(&draft.id).unwrap().markdown,
            draft.markdown
        );
        assert_eq!(
            files
                .latest_metadata(None)
                .unwrap()
                .get(&draft.id)
                .unwrap()
                .summary
                .bytes,
            draft.markdown.len()
        );
    }
    #[cfg(unix)]
    #[test]
    fn refuses_linked_draft_directory_and_linked_files() {
        use std::os::unix::fs::symlink;
        let (temp, files, draft) = fixture();
        let outside = temp.0.join("original.md");
        fs::write(&outside, "keep").unwrap();
        files.prepare().unwrap();
        let path = files.directory.join(format!("draft-{}-1.json", draft.id));
        symlink(&outside, &path).unwrap();
        assert!(files.remove(&draft.id).is_err());
        assert_eq!(fs::read_to_string(outside).unwrap(), "keep");
        fs::remove_file(path).unwrap();
        fs::remove_dir(&files.directory).unwrap();
        symlink(&temp.0, &files.directory).unwrap();
        assert!(files.prepare().is_err());
    }
}
