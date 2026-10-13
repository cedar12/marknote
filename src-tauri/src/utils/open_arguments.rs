//! Keep OS file arguments as paths until the frontend handles explicit file URLs.
use std::sync::Mutex;

#[derive(Default)]
pub struct OpenedUrls(Mutex<Option<Vec<String>>>);

impl OpenedUrls {
    pub fn replace_command_line(&self, arguments: impl IntoIterator<Item = String>) {
        // Parsing a Windows path as a URL treats its drive letter as the scheme
        // and percent-encodes filenames. Native paths must cross IPC unchanged.
        let arguments: Vec<String> = arguments.into_iter().skip(1).collect();
        if !arguments.is_empty() {
            self.replace(arguments);
        }
    }

    pub fn replace(&self, arguments: Vec<String>) {
        self.0.lock().unwrap().replace(arguments);
    }

    pub fn arguments(&self) -> Vec<String> {
        self.0.lock().unwrap().clone().unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

    fn through_ipc(paths: &[&str]) -> Vec<String> {
        let arguments = std::iter::once("MarkNote.exe")
            .chain(paths.iter().copied())
            .map(str::to_owned);
        let state = OpenedUrls::default();
        state.replace_command_line(arguments);
        let serialized = serde_json::to_string(&state.arguments()).unwrap();
        serde_json::from_str(&serialized).unwrap()
    }

    #[test]
    fn windows_filenames_keep_unicode_spaces_and_reserved_url_characters() {
        let paths = [
            r"D:\work\EMS升级\功能清单.md",
            r"C:\My Notes\draft #1.md",
            r"D:\notes\100%20 complete.md",
        ];
        assert_eq!(through_ipc(&paths), paths);
    }

    #[test]
    fn unc_and_relative_paths_are_not_dropped_or_rewritten() {
        let paths = [
            r"\\server\共享文件夹\说明 #100%.md",
            r".\notes\说明.md",
            "notes/relative #100%.md",
            "/home/user/My Notes/说明.md",
        ];
        assert_eq!(through_ipc(&paths), paths);
    }

    #[test]
    fn explicit_file_urls_keep_their_encoding_for_frontend_decoding() {
        let paths = ["file:///D:/My%20Notes/%E8%AF%B4%E6%98%8E%20%231%25.md"];
        assert_eq!(through_ipc(&paths), paths);
    }

    #[test]
    fn only_the_executable_argument_is_removed() {
        assert!(through_ipc(&[]).is_empty());
        let arguments = ["--", "-relative.md", "notes.md"];
        assert_eq!(through_ipc(&arguments), arguments);
    }

    struct Directory(PathBuf);
    impl Drop for Directory {
        fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); }
    }

    #[test]
    fn file_association_argument_still_opens_the_original_file_after_ipc() {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let directory = Directory(std::env::temp_dir().join(format!("marknote-open-{}-{nonce}", std::process::id())));
        fs::create_dir(&directory.0).unwrap();
        let path = directory.0.join("中文 空格 #100%20.md");
        fs::write(&path, "# Existing document\n").unwrap();
        let argument = path.to_str().unwrap();
        let received = through_ipc(&[argument]);
        assert_eq!(fs::read_to_string(&received[0]).unwrap(), "# Existing document\n");
    }
}
