//! Read-only, paged workspace search. Sessions are isolated by window and search ID.
use super::file_version::FileVersion;
use regex::{Regex, RegexBuilder};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File, ReadDir},
    io::Read,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Instant, UNIX_EPOCH},
};
use tauri::WebviewWindow;

const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 64 * 1024 * 1024;
const MAX_FILES: usize = 2000;
const MAX_ENTRIES: usize = 20000;
const MAX_RESULTS: usize = 300;
const MAX_DEPTH: usize = 32;
const TTL_SECS: u64 = 120;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    path: String,
    relative_path: String,
    version: FileVersion,
    from: usize,
    to: usize,
    line: usize,
    column: usize,
    before: String,
    matched: String,
    after: String,
}
#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SkipReasons {
    large: usize,
    unreadable: usize,
    links: usize,
    depth: usize,
    changed: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSearchPage {
    search_id: String,
    root: String,
    results: Vec<SearchMatch>,
    scanned_files: usize,
    scanned_entries: usize,
    skipped_files: usize,
    skip_reasons: SkipReasons,
    done: bool,
    cancelled: bool,
    truncated: bool,
}
struct Scan {
    root: PathBuf,
    pattern: Regex,
    directories: Vec<ReadDir>,
    files: usize,
    entries: usize,
    bytes: u64,
    matches: usize,
    skipped: SkipReasons,
    done: bool,
    truncated: bool,
}
struct Session {
    scan: Mutex<Scan>,
    cancelled: AtomicBool,
    touched: Mutex<Instant>,
}
lazy_static! {
    static ref SESSIONS: Mutex<HashMap<(String, String), Arc<Session>>> =
        Mutex::new(HashMap::new());
}

fn link_or_reparse(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    false
}
fn identity(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        PathBuf::from(path.to_string_lossy().to_lowercase())
    }
    #[cfg(not(windows))]
    {
        path.to_path_buf()
    }
}
fn checked_path(root: &Path, path: &Path) -> Result<PathBuf, &'static str> {
    if !path.starts_with(root) {
        return Err("outside_root");
    }
    let relative = path.strip_prefix(root).map_err(|_| "outside_root")?;
    let mut cursor = root.to_path_buf();
    if link_or_reparse(&fs::symlink_metadata(&cursor).map_err(|_| "unreadable")?) {
        return Err("link");
    }
    for part in relative.components() {
        cursor.push(part);
        if link_or_reparse(&fs::symlink_metadata(&cursor).map_err(|_| "unreadable")?) {
            return Err("link");
        }
    }
    let canonical = fs::canonicalize(path).map_err(|_| "unreadable")?;
    if !identity(&canonical).starts_with(identity(root)) {
        return Err("outside_root");
    }
    Ok(canonical)
}
fn stamp(metadata: &fs::Metadata) -> String {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|time| time.as_nanos().to_string())
        .unwrap_or_else(|| "0".into())
}
fn bounded_snapshot(
    root: &Path,
    path: &Path,
    cancel: &AtomicBool,
    read_bytes: &mut u64,
) -> Result<(String, FileVersion), &'static str> {
    let canonical = checked_path(root, path)?;
    let metadata = fs::metadata(&canonical).map_err(|_| "unreadable")?;
    if !metadata.is_file() {
        return Err("unreadable");
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err("large");
    }
    let mut file = File::open(&canonical).map_err(|_| "unreadable")?;
    let before = file.metadata().map_err(|_| "unreadable")?;
    let mut content = Vec::new();
    let mut buffer = [0u8; 65536];
    loop {
        if cancel.load(Ordering::Acquire) {
            return Err("cancelled");
        }
        if content.len() as u64 == before.len() {
            break;
        }
        let available = MAX_TOTAL_BYTES.saturating_sub(*read_bytes);
        if available == 0 {
            return Err("budget");
        }
        let read_limit = buffer.len().min(available as usize);
        let count = file
            .read(&mut buffer[..read_limit])
            .map_err(|_| "unreadable")?;
        if count == 0 {
            break;
        }
        *read_bytes += count as u64;
        if content.len() as u64 + count as u64 > MAX_FILE_BYTES {
            return Err("large");
        }
        content.extend_from_slice(&buffer[..count]);
    }
    let after = file.metadata().map_err(|_| "unreadable")?;
    if content.len() as u64 != before.len()
        || before.len() != after.len()
        || stamp(&before) != stamp(&after)
        || checked_path(root, path)? != canonical
        || stamp(&fs::metadata(path).map_err(|_| "changed")?) != stamp(&after)
    {
        return Err("changed");
    }
    let version = FileVersion {
        exists: true,
        mtime_ns: stamp(&after),
        size: content.len() as u64,
        hash: format!("{:x}", Sha256::digest(&content)),
    };
    let text = String::from_utf8(content).map_err(|_| "unreadable")?;
    Ok((text, version))
}
fn take_head(text: &str, count: usize) -> String {
    text.chars().take(count).collect()
}
fn take_tail(text: &str, count: usize) -> String {
    let mut chars: Vec<char> = text.chars().rev().take(count).collect();
    chars.reverse();
    chars.into_iter().collect()
}
fn collect_matches(
    scan: &mut Scan,
    path: &Path,
    text: &str,
    version: FileVersion,
) -> Vec<SearchMatch> {
    let mut results = Vec::new();
    let mut byte_cursor = 0;
    let mut utf16_cursor = 0;
    let mut line = 1;
    let mut line_start_utf16 = 0;
    for found in scan.pattern.find_iter(text) {
        if scan.matches >= MAX_RESULTS {
            scan.done = true;
            scan.truncated = true;
            break;
        }
        for character in text[byte_cursor..found.start()].chars() {
            utf16_cursor += character.len_utf16();
            if character == '\n' {
                line += 1;
                line_start_utf16 = utf16_cursor;
            }
        }
        let from = utf16_cursor;
        let matched = found.as_str();
        let to = from + matched.encode_utf16().count();
        let prefix_start = text[..found.start()]
            .char_indices()
            .rev()
            .nth(45)
            .map(|(index, _)| index)
            .unwrap_or(0);
        let suffix_end = text[found.end()..]
            .char_indices()
            .nth(45)
            .map(|(index, _)| found.end() + index)
            .unwrap_or(text.len());
        results.push(SearchMatch {
            path: path.to_string_lossy().into_owned(),
            relative_path: path
                .strip_prefix(&scan.root)
                .unwrap_or(path)
                .to_string_lossy()
                .into_owned(),
            version: version.clone(),
            from,
            to,
            line,
            column: from - line_start_utf16 + 1,
            before: take_tail(&text[prefix_start..found.start()], 45),
            matched: take_head(matched, 120),
            after: take_head(&text[found.end()..suffix_end], 45),
        });
        // Include newlines inside a multi-line literal in the next coordinate update.
        byte_cursor = found.start();
        scan.matches += 1;
    }
    results
}
fn page(search_id: &str, session: &Session) -> Result<WorkspaceSearchPage, String> {
    *session.touched.lock().map_err(|_| "search_lock_failed")? = Instant::now();
    let mut scan = session.scan.lock().map_err(|_| "search_lock_failed")?;
    let mut results = Vec::new();
    let mut processed = 0;
    let mut page_files = 0;
    while !scan.done
        && !session.cancelled.load(Ordering::Acquire)
        && processed < 128
        && page_files < 8
    {
        if scan.files >= MAX_FILES || scan.entries >= MAX_ENTRIES || scan.bytes >= MAX_TOTAL_BYTES {
            scan.done = true;
            scan.truncated = true;
            break;
        }
        let entry = match scan.directories.last_mut() {
            Some(directory) => directory.next(),
            None => {
                scan.done = true;
                break;
            }
        };
        let entry = match entry {
            None => {
                scan.directories.pop();
                continue;
            }
            Some(Err(_)) => {
                scan.entries += 1;
                scan.skipped.unreadable += 1;
                processed += 1;
                continue;
            }
            Some(Ok(entry)) => entry,
        };
        processed += 1;
        scan.entries += 1;
        let candidate = entry.path();
        let canonical = match checked_path(&scan.root, &candidate) {
            Ok(path) => path,
            Err("link" | "outside_root") => {
                scan.skipped.links += 1;
                continue;
            }
            Err(_) => {
                scan.skipped.unreadable += 1;
                continue;
            }
        };
        let metadata = match fs::metadata(&canonical) {
            Ok(value) => value,
            Err(_) => {
                scan.skipped.unreadable += 1;
                continue;
            }
        };
        if metadata.is_dir() {
            if scan.directories.len() >= MAX_DEPTH {
                scan.skipped.depth += 1;
                continue;
            }
            match fs::read_dir(&canonical) {
                Ok(directory) => scan.directories.push(directory),
                Err(_) => scan.skipped.unreadable += 1,
            };
            continue;
        }
        let extension = canonical
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !metadata.is_file() || !["md", "markdown"].contains(&extension.as_str()) {
            continue;
        }
        scan.files += 1;
        page_files += 1;
        if metadata.len() > MAX_FILE_BYTES {
            scan.skipped.large += 1;
            continue;
        }
        if scan.bytes + metadata.len() > MAX_TOTAL_BYTES {
            scan.done = true;
            scan.truncated = true;
            break;
        }
        let search_root = scan.root.clone();
        match bounded_snapshot(
            &search_root,
            &canonical,
            &session.cancelled,
            &mut scan.bytes,
        ) {
            Ok((text, version)) => {
                results.extend(collect_matches(&mut scan, &canonical, &text, version));
            }
            Err("large") => scan.skipped.large += 1,
            Err("budget") => {
                scan.done = true;
                scan.truncated = true;
            }
            Err("changed") => scan.skipped.changed += 1,
            Err("link" | "outside_root") => scan.skipped.links += 1,
            Err("cancelled") => break,
            Err(_) => scan.skipped.unreadable += 1,
        }
    }
    let skipped_files = scan.skipped.large
        + scan.skipped.unreadable
        + scan.skipped.links
        + scan.skipped.depth
        + scan.skipped.changed;
    Ok(WorkspaceSearchPage {
        search_id: search_id.into(),
        root: scan.root.to_string_lossy().into_owned(),
        results,
        scanned_files: scan.files,
        scanned_entries: scan.entries,
        skipped_files,
        skip_reasons: scan.skipped.clone(),
        done: scan.done,
        cancelled: session.cancelled.load(Ordering::Acquire),
        truncated: scan.truncated,
    })
}
fn key(window: &WebviewWindow, id: &str) -> Result<(String, String), String> {
    if id.is_empty()
        || id.len() > 128
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("invalid_search_id".into());
    }
    Ok((window.label().into(), id.into()))
}
#[tauri::command(async)]
pub fn workspace_search_start(
    window: WebviewWindow,
    search_id: String,
    root: String,
    query: String,
    case_sensitive: bool,
) -> Result<WorkspaceSearchPage, String> {
    let key = key(&window, &search_id)?;
    if query.is_empty() || query.encode_utf16().count() > 256 {
        return Err("invalid_search_query".into());
    }
    let metadata = fs::symlink_metadata(&root).map_err(|_| "workspace_unreadable")?;
    if link_or_reparse(&metadata) || !metadata.is_dir() {
        return Err("invalid_workspace_root".into());
    }
    let canonical = fs::canonicalize(&root).map_err(|_| "workspace_unreadable")?;
    let directory = fs::read_dir(&canonical).map_err(|_| "workspace_unreadable")?;
    let pattern = RegexBuilder::new(&regex::escape(&query))
        .case_insensitive(!case_sensitive)
        .build()
        .map_err(|_| "invalid_search_query")?;
    let session = Arc::new(Session {
        scan: Mutex::new(Scan {
            root: canonical,
            pattern,
            directories: vec![directory],
            files: 0,
            entries: 0,
            bytes: 0,
            matches: 0,
            skipped: SkipReasons::default(),
            done: false,
            truncated: false,
        }),
        cancelled: AtomicBool::new(false),
        touched: Mutex::new(Instant::now()),
    });
    {
        let mut sessions = SESSIONS.lock().map_err(|_| "search_lock_failed")?;
        sessions.retain(|_, value| {
            value
                .touched
                .lock()
                .map(|time| time.elapsed().as_secs() < TTL_SECS)
                .unwrap_or(false)
        });
        if sessions.contains_key(&key) {
            return Err("duplicate_search_id".into());
        }
        if sessions.len() >= 64 {
            return Err("too_many_searches".into());
        }
        sessions.insert(key, session.clone());
    }
    page(&search_id, &session)
}
#[tauri::command(async)]
pub fn workspace_search_next(
    window: WebviewWindow,
    search_id: String,
) -> Result<WorkspaceSearchPage, String> {
    let session = SESSIONS
        .lock()
        .map_err(|_| "search_lock_failed")?
        .get(&key(&window, &search_id)?)
        .cloned()
        .ok_or("search_expired")?;
    page(&search_id, &session)
}
#[tauri::command(async)]
pub fn workspace_search_cancel(window: WebviewWindow, search_id: String) -> Result<(), String> {
    if let Some(session) = SESSIONS
        .lock()
        .map_err(|_| "search_lock_failed")?
        .remove(&key(&window, &search_id)?)
    {
        session.cancelled.store(true, Ordering::Release);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn literal_matches_have_utf16_coordinates_and_escaped_snippets() {
        let root = std::env::temp_dir();
        let mut scan = Scan {
            root: root.clone(),
            pattern: Regex::new(&regex::escape("<b>")).unwrap(),
            directories: vec![],
            files: 0,
            entries: 0,
            bytes: 0,
            matches: 0,
            skipped: SkipReasons::default(),
            done: false,
            truncated: false,
        };
        let version = FileVersion {
            exists: true,
            mtime_ns: "0".into(),
            size: 0,
            hash: String::new(),
        };
        let results = collect_matches(
            &mut scan,
            &root.join("test.md"),
            "😀\nfirst <b>\nsecond <b>",
            version,
        );
        assert_eq!(
            (results[0].from, results[0].line, results[0].column),
            (9, 2, 7)
        );
        assert_eq!((results[1].line, results[1].column), (3, 8));
        assert_eq!(results[0].matched, "<b>");
    }
    #[test]
    fn outside_root_is_rejected_before_any_read() {
        assert!(checked_path(
            &std::env::temp_dir().join("workspace"),
            &std::env::temp_dir().join("private.md")
        )
        .is_err());
    }
}
