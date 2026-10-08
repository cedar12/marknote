use std::{
    collections::{BTreeMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const MAX_THEME_BYTES: u64 = 1024 * 1024;
static THEME_FILES: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Theme {
    pub label: String,
    pub value: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub style: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThemeEntry {
    #[serde(flatten)]
    pub theme: Theme,
    pub source: &'static str,
    pub removable: bool,
}

#[derive(Debug, Serialize)]
pub struct ThemeError {
    pub code: &'static str,
    pub message: String,
}

impl ThemeError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }

    fn io(error: impl std::fmt::Display) -> Self {
        Self::new("io_error", format!("Could not access theme files: {error}"))
    }
}

type ThemeResult<T> = Result<T, ThemeError>;

struct ThemeStore {
    installed: PathBuf,
    bundled: Option<PathBuf>,
}

impl ThemeStore {
    fn for_app(app: &AppHandle) -> ThemeResult<Self> {
        let data = app.path().app_data_dir()
            .map_err(|error| ThemeError::new("path_error", error.to_string()))?;
        Ok(Self {
            installed: data.join("themes"),
            bundled: app.path().resource_dir().ok().map(|dir| dir.join("themes")),
        })
    }

    fn list(&self) -> ThemeResult<Vec<ThemeEntry>> {
        let mut entries = Vec::new();
        let mut seen = HashSet::new();
        for (theme, _) in read_theme_directory(&self.installed)? {
            if !is_builtin(&theme.value) && seen.insert(theme.value.to_ascii_lowercase()) {
                entries.push(ThemeEntry { theme, source: "installed", removable: true });
            }
        }
        if let Some(directory) = &self.bundled {
            // A missing resource directory is normal in some development builds.
            match read_theme_directory(directory) {
                Ok(themes) => {
                    for (theme, _) in themes {
                        if !is_builtin(&theme.value) && seen.insert(theme.value.to_ascii_lowercase()) {
                            entries.push(ThemeEntry { theme, source: "bundled", removable: false });
                        }
                    }
                }
                Err(error) => log::warn!("Could not load bundled themes: {}", error.message),
            }
        }
        entries.sort_by(|a, b| a.theme.label.to_lowercase().cmp(&b.theme.label.to_lowercase())
            .then(a.theme.value.cmp(&b.theme.value)));
        Ok(entries)
    }

    fn install(&self, source: &Path) -> ThemeResult<Theme> {
        if !source.is_absolute() || !is_json(source) {
            return Err(ThemeError::new("invalid_theme", "Select a JSON theme file."));
        }
        let theme = read_theme(source)?;
        check_custom_id(&theme.value)?;
        if self.list()?.iter().any(|entry| entry.theme.value.eq_ignore_ascii_case(&theme.value)) {
            return Err(ThemeError::new("duplicate_theme", "A theme with this value is already available."));
        }
        ensure_theme_directory(&self.installed)?;
        // The prefix also avoids Windows reserved file names such as CON and NUL.
        let destination = self.installed.join(format!("theme-{}.json", theme.value));
        let json = serde_json::to_vec_pretty(&theme).map_err(ThemeError::io)?;
        let mut file = OpenOptions::new().write(true).create_new(true).open(&destination)
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::AlreadyExists {
                    ThemeError::new("duplicate_theme", "A theme file with this value already exists.")
                } else {
                    ThemeError::io(error)
                }
            })?;
        if let Err(error) = file.write_all(&json).and_then(|_| file.sync_all()) {
            drop(file);
            let _ = fs::remove_file(&destination);
            return Err(ThemeError::io(error));
        }
        Ok(theme)
    }

    fn uninstall(&self, value: &str) -> ThemeResult<()> {
        check_custom_id(value)?;
        let installed = read_theme_directory(&self.installed)?;
        let files: Vec<PathBuf> = installed.into_iter()
            .filter(|(theme, _)| theme.value == value)
            .map(|(_, path)| path)
            .collect();
        if files.is_empty() {
            return Err(ThemeError::new("theme_not_found", "This theme is not installed in the user theme directory."));
        }
        let root = fs::canonicalize(&self.installed).map_err(ThemeError::io)?;
        for path in files {
            let metadata = fs::symlink_metadata(&path).map_err(ThemeError::io)?;
            let actual = fs::canonicalize(&path).map_err(ThemeError::io)?;
            if is_link(&metadata) || !metadata.is_file() || actual.parent() != Some(root.as_path()) {
                return Err(ThemeError::new("path_error", "The installed theme path is unsafe."));
            }
            // Revalidate the identity before deleting any file, including manually copied themes.
            if read_theme(&path)?.value != value {
                return Err(ThemeError::new("theme_not_found", "The installed theme file has changed."));
            }
            fs::remove_file(path).map_err(ThemeError::io)?;
        }
        Ok(())
    }
}

fn is_builtin(value: &str) -> bool {
    value.eq_ignore_ascii_case("light") || value.eq_ignore_ascii_case("dark")
}

fn valid_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128
        && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn check_custom_id(value: &str) -> ThemeResult<()> {
    if is_builtin(value) {
        return Err(ThemeError::new("builtin_theme", "Built-in Light and Dark themes cannot be replaced or uninstalled."));
    }
    if !valid_id(value) {
        return Err(ThemeError::new("invalid_theme", "Theme value must contain 1–128 letters, digits, underscores or hyphens."));
    }
    Ok(())
}

fn parse_theme(json: &str) -> ThemeResult<Theme> {
    crate::utils::schema::validate(json)
        .map_err(|error| ThemeError::new("invalid_theme", error.to_string()))?;
    let theme: Theme = serde_json::from_str(json)
        .map_err(|error| ThemeError::new("invalid_theme", error.to_string()))?;
    if theme.label.trim().is_empty() || theme.label.chars().any(char::is_control) || !valid_id(&theme.value) {
        return Err(ThemeError::new("invalid_theme", "Theme label and value must be valid nonempty strings."));
    }
    Ok(theme)
}

fn read_theme(path: &Path) -> ThemeResult<Theme> {
    let file = File::open(path).map_err(ThemeError::io)?;
    let metadata = file.metadata().map_err(ThemeError::io)?;
    if !metadata.is_file() || metadata.len() > MAX_THEME_BYTES {
        return Err(ThemeError::new("invalid_theme", "Theme file must be a regular JSON file no larger than 1 MB."));
    }
    let mut json = String::new();
    file.take(MAX_THEME_BYTES + 1).read_to_string(&mut json)
        .map_err(|error| ThemeError::new("invalid_theme", format!("Could not read a UTF-8 theme file: {error}")))?;
    if json.len() as u64 > MAX_THEME_BYTES {
        return Err(ThemeError::new("invalid_theme", "Theme file exceeds 1 MB."));
    }
    parse_theme(&json)
}

fn is_json(path: &Path) -> bool {
    path.extension().and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("json")).unwrap_or(false)
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

fn check_theme_directory(directory: &Path) -> ThemeResult<bool> {
    match fs::symlink_metadata(directory) {
        Ok(metadata) if !metadata.is_dir() || is_link(&metadata) =>
            Err(ThemeError::new("path_error", "The theme directory must be a regular directory.")),
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(ThemeError::io(error)),
    }
}

fn ensure_theme_directory(directory: &Path) -> ThemeResult<()> {
    if !check_theme_directory(directory)? {
        let parent = directory.parent()
            .ok_or_else(|| ThemeError::new("path_error", "Could not resolve the theme directory."))?;
        fs::create_dir_all(parent).map_err(ThemeError::io)?;
        match fs::create_dir(directory) {
            Ok(()) => {},
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {},
            Err(error) => return Err(ThemeError::io(error)),
        }
        check_theme_directory(directory)?;
    }
    Ok(())
}

fn read_theme_directory(directory: &Path) -> ThemeResult<Vec<(Theme, PathBuf)>> {
    if !check_theme_directory(directory)? {
        return Ok(Vec::new());
    }
    let mut paths = Vec::new();
    for entry in fs::read_dir(directory).map_err(ThemeError::io)? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => { log::warn!("Skipping unreadable theme directory entry: {error}"); continue; },
        };
        let path = entry.path();
        if is_json(&path) {
            match fs::symlink_metadata(&path) {
                Ok(metadata) if metadata.is_file() && !is_link(&metadata) => paths.push(path),
                _ => {},
            }
        }
    }
    paths.sort();
    let mut themes = Vec::new();
    for path in paths {
        match read_theme(&path) {
            Ok(theme) => themes.push((theme, path)),
            Err(error) => log::warn!("Skipping invalid theme {}: {}", path.display(), error.message),
        }
    }
    Ok(themes)
}

#[tauri::command]
pub fn theme_list(app: AppHandle) -> ThemeResult<Vec<ThemeEntry>> {
    let _guard = THEME_FILES.lock().map_err(ThemeError::io)?;
    ThemeStore::for_app(&app)?.list()
}

#[tauri::command]
pub fn theme_install(app: AppHandle, path: String) -> ThemeResult<Theme> {
    let _guard = THEME_FILES.lock().map_err(ThemeError::io)?;
    ThemeStore::for_app(&app)?.install(Path::new(&path))
}

#[tauri::command]
pub fn theme_uninstall(app: AppHandle, value: String) -> ThemeResult<()> {
    let _guard = THEME_FILES.lock().map_err(ThemeError::io)?;
    ThemeStore::for_app(&app)?.uninstall(&value)
}

pub fn theme_json(app: AppHandle) -> ThemeResult<Vec<String>> {
    theme_list(app)?.into_iter().map(|entry| serde_json::to_string(&entry.theme).map_err(ThemeError::io)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT_TEST: AtomicUsize = AtomicUsize::new(0);

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let directory = std::env::temp_dir().join(format!("marknote-theme-test-{}-{}", std::process::id(), NEXT_TEST.fetch_add(1, Ordering::Relaxed)));
            fs::create_dir_all(&directory).unwrap();
            Self(directory)
        }

        fn store(&self) -> ThemeStore {
            ThemeStore { installed: self.0.join("themes"), bundled: Some(self.0.join("bundled")) }
        }

        fn write_theme(&self, value: &str) -> PathBuf {
            let path = self.0.join(format!("source-{value}.json"));
            fs::write(&path, fixture_theme(value).to_string()).unwrap();
            path
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); }
    }

    fn fixture_theme(value: &str) -> Value {
        let mut theme: Value = serde_json::from_str(include_str!("../../themes/light.json")).unwrap();
        theme["value"] = json!(value);
        theme
    }

    #[test]
    fn validates_required_fields_types_and_all_colors() {
        let good = fixture_theme("sample");
        assert!(parse_theme(&good.to_string()).is_ok());
        for field in ["label", "value", "type", "style"] {
            let mut theme = good.clone();
            theme.as_object_mut().unwrap().remove(field);
            assert_eq!(parse_theme(&theme.to_string()).unwrap_err().code, "invalid_theme");
        }
        for field in good["style"].as_object().unwrap().keys() {
            let mut missing = good.clone();
            missing["style"].as_object_mut().unwrap().remove(field);
            assert!(parse_theme(&missing.to_string()).is_err());
            let mut invalid = good.clone();
            invalid["style"][field] = json!("url(https://example.com)");
            assert!(parse_theme(&invalid.to_string()).is_err());
        }
        for (field, value) in [("label", json!("  ")), ("value", json!("../outside")), ("type", json!("blue")), ("style", json!([]))] {
            let mut theme = good.clone();
            theme[field] = value;
            assert!(parse_theme(&theme.to_string()).is_err());
        }
    }

    #[test]
    fn install_list_uninstall_round_trip_preserves_source() {
        let fixture = Fixture::new();
        let store = fixture.store();
        let source = fixture.write_theme("custom");
        assert!(store.list().unwrap().is_empty());
        let theme = store.install(&source).unwrap();
        let installed = store.list().unwrap();
        assert_eq!(installed.len(), 1);
        assert_eq!(installed[0].theme, theme);
        assert!(installed[0].removable);
        assert_eq!(installed[0].source, "installed");
        assert!(store.installed.join("theme-custom.json").is_file());
        store.uninstall("custom").unwrap();
        assert!(store.list().unwrap().is_empty());
        assert!(source.is_file());
    }

    #[test]
    fn protects_builtins_duplicates_and_outside_paths() {
        let fixture = Fixture::new();
        let store = fixture.store();
        for value in ["light", "DARK"] {
            let source = fixture.write_theme(value);
            assert_eq!(store.install(&source).unwrap_err().code, "builtin_theme");
            assert_eq!(store.uninstall(value).unwrap_err().code, "builtin_theme");
        }
        let source = fixture.write_theme("custom");
        store.install(&source).unwrap();
        assert_eq!(store.install(&source).unwrap_err().code, "duplicate_theme");
        let case_duplicate = fixture.write_theme("CUSTOM");
        assert_eq!(store.install(&case_duplicate).unwrap_err().code, "duplicate_theme");
        for value in ["../source-custom", "C:\\outside", "custom.json", "", "a/b"] {
            assert_eq!(store.uninstall(value).unwrap_err().code, "invalid_theme");
        }
        assert_eq!(store.uninstall("unknown").unwrap_err().code, "theme_not_found");
        assert!(source.is_file());
        assert!(store.installed.join("theme-custom.json").is_file());
    }

    #[test]
    fn lists_bundled_themes_and_skips_broken_files_and_directories() {
        let fixture = Fixture::new();
        let store = fixture.store();
        fs::create_dir_all(store.bundled.as_ref().unwrap()).unwrap();
        fs::create_dir_all(&store.installed).unwrap();
        let bundled = store.bundled.as_ref().unwrap();
        fs::write(bundled.join("custom.json"), fixture_theme("bundled").to_string()).unwrap();
        fs::write(bundled.join("built-in.json"), fixture_theme("light").to_string()).unwrap();
        fs::write(store.installed.join("broken.json"), "{}").unwrap();
        fs::write(store.installed.join("no-extension"), "{}").unwrap();
        fs::create_dir(store.installed.join("folder.json")).unwrap();
        let entries = store.list().unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].source, "bundled");
        assert!(!entries[0].removable);
        assert_eq!(store.install(&fixture.write_theme("bundled")).unwrap_err().code, "duplicate_theme");
        assert_eq!(store.uninstall("bundled").unwrap_err().code, "theme_not_found");
        assert!(bundled.join("custom.json").is_file());
    }

    #[test]
    fn refuses_directory_links_and_file_links() {
        let fixture = Fixture::new();
        let store = fixture.store();
        fs::create_dir_all(&store.installed).unwrap();
        let source = fixture.write_theme("linked");
        let destination = store.installed.join("linked.json");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&source, &destination).unwrap();
        #[cfg(windows)]
        if std::os::windows::fs::symlink_file(&source, &destination).is_err() {
            // Windows without Developer Mode can disallow symlink creation.
            return;
        }
        assert!(store.list().unwrap().is_empty());
        assert_eq!(store.uninstall("linked").unwrap_err().code, "theme_not_found");
        assert!(source.is_file());
        fs::remove_file(destination).unwrap();
        fs::remove_dir(&store.installed).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&fixture.0, &store.installed).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&fixture.0, &store.installed).unwrap();
        assert_eq!(store.list().unwrap_err().code, "path_error");
        assert_eq!(store.install(&source).unwrap_err().code, "path_error");
        // Remove this link explicitly so test fixture cleanup does not traverse it.
        #[cfg(unix)]
        fs::remove_file(&store.installed).unwrap();
        #[cfg(windows)]
        fs::remove_dir(&store.installed).unwrap();
    }

    #[test]
    fn rejects_oversized_theme_files() {
        let fixture = Fixture::new();
        let path = fixture.0.join("large.json");
        File::create(&path).unwrap().set_len(MAX_THEME_BYTES + 1).unwrap();
        assert_eq!(fixture.store().install(&path).unwrap_err().code, "invalid_theme");
    }
}
