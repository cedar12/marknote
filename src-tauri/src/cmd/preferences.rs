use std::{collections::HashMap, process::Command, env};

use crate::{db, resp::{Resp, self}, utils::constant};

use super::utils::cmd_args;



#[tauri::command]
pub fn save_image_type(save_type:&str,path:&str) ->Resp<()>{
    let mut map=HashMap::new();
    map.insert(constant::config::IMAGE_SAVE_TYPE.into(), save_type.to_string());
    map.insert(constant::config::IMAGE_SAVE_PATH.into(), path.to_string());
    match db::config_set(map){
        Ok(())=>{
            resp::data(None)
        },
        Err(e)=>{
            resp::err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn get_config() ->Resp<HashMap<String,String>>{
    match db::config_map(){
        Ok(map)=>resp::data(Some(map)),
        Err(e)=>resp::err(e.to_string())
    }
    
}

#[tauri::command]
pub fn save_markdown_preferences(options: crate::utils::md::MarkdownOptions) -> Resp<()> {
    if let Err(error) = options.validate() {
        return resp::err(error);
    }
    let json = match serde_json::to_string(&options) {
        Ok(json) => json,
        Err(error) => return resp::err(error.to_string()),
    };
    let mut config = HashMap::new();
    config.insert("markdown_preferences".to_string(), json);
    match db::config_set(config) {
        Ok(()) => resp::data(None),
        Err(error) => resp::err(error.to_string()),
    }
}

const SHORTCUT_COMMANDS: &[&str] = &[
    "file.newWindow", "file.newFile", "file.openFile", "file.save", "file.saveAs",
    "file.preferences", "file.closeWindow", "file.quit",
    "edit.cut", "edit.copy", "edit.paste", "edit.undo", "edit.redo", "edit.selectAll", "edit.find",
    "format.bold", "format.italic", "format.strikethrough", "format.inlineCode",
    "paragraph.normalText", "paragraph.heading1", "paragraph.heading2", "paragraph.heading3",
    "paragraph.heading4", "paragraph.heading5", "paragraph.heading6", "paragraph.table",
    "paragraph.codeFences", "paragraph.bulletList", "paragraph.orderedList", "paragraph.taskList",
    "paragraph.quoteBlock", "paragraph.mathBlock", "paragraph.paragraph", "paragraph.horizontalRule",
    "view.sidebar",
];

fn validate_shortcut_preferences(options: &HashMap<String, String>) -> Result<(), String> {
    if options.len() != SHORTCUT_COMMANDS.len()
        || SHORTCUT_COMMANDS.iter().any(|command| !options.contains_key(*command))
    {
        return Err("Invalid shortcut commands".into());
    }
    let mut used = HashMap::<String, &str>::new();
    for (command, shortcut) in options {
        if shortcut.is_empty() {
            continue;
        }
        if shortcut.len() > 80 {
            return Err(format!("Invalid shortcut for {command}"));
        }
        let mut parts: Vec<&str> = shortcut.split('+').collect();
        let key = parts.pop().unwrap_or("");
        let is_function_key = key.strip_prefix('F')
            .and_then(|number| number.parse::<u8>().ok())
            .map(|number| (1..=12).contains(&number) && key == format!("F{number}"))
            .unwrap_or(false);
        let is_character = key.len() == 1 && key.chars().all(|value|
            value.is_ascii_uppercase() || value.is_ascii_digit() || "=-,./;'[]\\`".contains(value));
        let is_named = ["Enter", "Tab", "Space", "Escape", "Backspace", "Delete", "Insert",
            "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
            .contains(&key);
        if !(is_character || is_function_key || is_named) {
            return Err(format!("Invalid shortcut for {command}"));
        }
        let modifiers = ["Mod", "Ctrl", "Meta", "Alt", "Shift"];
        let mut previous_index: Option<usize> = None;
        let mut resolved = Vec::new();
        let mut command_modifier = false;
        for part in parts {
            let index = modifiers.iter().position(|modifier| *modifier == part)
                .ok_or_else(|| format!("Invalid shortcut for {command}"))?;
            if previous_index.map(|previous| index <= previous).unwrap_or(false) {
                return Err(format!("Invalid shortcut for {command}"));
            }
            previous_index = Some(index);
            command_modifier |= part != "Shift";
            let modifier = if part == "Mod" {
                if cfg!(target_os = "macos") { "Meta" } else { "Ctrl" }
            } else { part };
            if resolved.contains(&modifier) {
                return Err(format!("Invalid shortcut for {command}"));
            }
            resolved.push(modifier);
        }
        if !command_modifier && !is_function_key {
            return Err(format!("Invalid shortcut for {command}"));
        }
        // Mod can resolve after another modifier in the canonical portable order.
        // Sorting physical modifiers detects equivalent Ctrl+Meta combinations too.
        resolved.sort_unstable();
        resolved.push(key);
        let resolved = resolved.join("+");
        if let Some(other) = used.insert(resolved, command) {
            return Err(format!("Conflicting shortcuts for {other} and {command}"));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn save_shortcut_preferences(options: HashMap<String, String>) -> Resp<()> {
    if let Err(error) = validate_shortcut_preferences(&options) {
        return resp::err(error);
    }
    let json = match serde_json::to_string(&options) {
        Ok(json) => json,
        Err(error) => return resp::err(error.to_string()),
    };
    let mut config = HashMap::new();
    config.insert("shortcut_preferences".to_string(), json);
    match db::config_set(config) {
        Ok(()) => resp::data(None),
        Err(error) => resp::err(error.to_string()),
    }
}

#[cfg(test)]
mod shortcut_tests {
    use super::{validate_shortcut_preferences, SHORTCUT_COMMANDS};
    use std::collections::HashMap;

    fn cleared_shortcuts() -> HashMap<String, String> {
        SHORTCUT_COMMANDS.iter().map(|command| (command.to_string(), String::new())).collect()
    }

    #[test]
    fn accepts_cleared_named_function_and_canonical_plus_shortcuts() {
        let mut options = cleared_shortcuts();
        assert!(validate_shortcut_preferences(&options).is_ok());
        options.insert("file.save".into(), "Mod+S".into());
        options.insert("edit.find".into(), "Alt+PageUp".into());
        options.insert("paragraph.table".into(), "F2".into());
        options.insert("paragraph.mathBlock".into(), "Shift+F3".into());
        options.insert("paragraph.horizontalRule".into(), "Mod+Shift+=".into());
        assert!(validate_shortcut_preferences(&options).is_ok());
    }

    #[test]
    fn rejects_unknown_or_missing_commands() {
        let mut options = cleared_shortcuts();
        options.remove("file.save");
        assert!(validate_shortcut_preferences(&options).is_err());
        options.insert("file.unknown".into(), "Mod+S".into());
        assert!(validate_shortcut_preferences(&options).is_err());
        options.insert("file.save".into(), "Mod+S".into());
        assert!(validate_shortcut_preferences(&options).is_err());
    }

    #[test]
    fn rejects_typing_keys_and_malformed_combinations() {
        for shortcut in ["A", "Shift+A", "Enter", "Shift+Enter", "Mod", "Mod+Shift",
            "Mod+Mod+S", "Shift+Mod+S", "Mod++", "Mod+Plus", "Mod+F13", "Mod+ S", "Mod+S+T"] {
            let mut options = cleared_shortcuts();
            options.insert("file.save".into(), shortcut.into());
            assert!(validate_shortcut_preferences(&options).is_err(), "accepted {shortcut}");
        }
        let mut options = cleared_shortcuts();
        options.insert("file.save".into(), "Mod+".to_owned() + &"A".repeat(81));
        assert!(validate_shortcut_preferences(&options).is_err());
    }

    #[test]
    fn rejects_duplicate_and_equivalent_primary_modifiers() {
        let mut options = cleared_shortcuts();
        options.insert("file.save".into(), "Mod+S".into());
        options.insert("edit.find".into(), "Mod+S".into());
        assert!(validate_shortcut_preferences(&options).is_err());
        let primary = if cfg!(target_os = "macos") { "Meta" } else { "Ctrl" };
        options.insert("edit.find".into(), format!("{primary}+S"));
        assert!(validate_shortcut_preferences(&options).is_err());
        options.insert("edit.find".into(), String::new());
        options.insert("file.save".into(), format!("Mod+{primary}+S"));
        assert!(validate_shortcut_preferences(&options).is_err());
        let secondary = if cfg!(target_os = "macos") { "Ctrl" } else { "Meta" };
        options.insert("file.save".into(), format!("Mod+{secondary}+Alt+K"));
        options.insert("edit.find".into(), "Ctrl+Meta+Alt+K".into());
        assert!(validate_shortcut_preferences(&options).is_err());
    }
}


#[tauri::command]
pub fn set_ftype(){
    #[cfg(target_os="windows")]
    {
        use std::os::windows::process::CommandExt;
        let exe_path=env::current_exe().unwrap();
        log::debug!("exe path: {}",exe_path.to_string_lossy());
        match Command::new("cmd").arg("/c").creation_flags(0x08000000).arg("ftype").arg(format!("Markdown={}",exe_path.to_string_lossy())).arg("%1").spawn(){
            Ok(child)=>{ 
                log::error!("child id {:?}",child.id());
            },
            Err(e)=>{
                log::error!("{:?}",e);
            }
        };
    }
    
    
}
