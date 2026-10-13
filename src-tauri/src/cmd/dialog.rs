
use tauri_plugin_dialog::DialogExt;

use crate::cmd::file_version::{self, FileVersion, MarkdownResponse};
use crate::utils::attachments::{AttachmentReference, stage_save_as_assets};


#[tauri::command(async)]
pub async fn save_as_md(handle: tauri::AppHandle, window: tauri::WebviewWindow, md:&str,title: &str,
    source_path: Option<String>, source_version: Option<FileVersion>, attachments: Option<Vec<AttachmentReference>>) ->Result<MarkdownResponse,String> {
    let file_path = handle.dialog().file().add_filter("Markdown", &["md"]).set_title(title).blocking_save_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.as_path().and_then(|path|path.to_str()){
            let target=file_version::canonical_target(fp)?;
            let same_source=source_path.as_deref().and_then(|source|file_version::canonical_target(source).ok())
                .map(|source|file_version::same_canonical_target(&source,&target)).unwrap_or(false);
            let captured=file_version::probe_file_version(fp.into(),None,Some(true))?;
            let expected=if same_source {source_version.as_ref()}else{captured.version.as_ref()};
            let mut stage=stage_save_as_assets(&target,source_path.as_deref(),md,attachments.as_deref().unwrap_or(&[])).map_err(|error|error.to_string())?;
            let mut response=file_version::save_markdown_checked(fp,&stage.markdown,expected)?;
            if response.code==0{
                response.data=Some(stage.markdown.clone());
                if !stage.mapping.is_empty(){response.attachment_mapping=Some(stage.mapping.clone());}
                stage.commit();
                file_version::emit_saved(&handle,&window,&response);
            }
            return Ok(response);
        }
    }
    Err("".into())
}


#[tauri::command(async)]
pub async fn open_file(handle: tauri::AppHandle,title: &str) ->Result<MarkdownResponse,String> {
    
    let file_path = handle.dialog().file().add_filter("Markdown", &["md"]).set_title(title).blocking_pick_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.as_path().and_then(|path|path.to_str()){
            // The shared frontend open action reads content and its baseline once,
            // and owns loading, unsaved changes and complete failure rollback.
            return Ok(MarkdownResponse { code:0,info:fp.into(),data:None,version:None,canonical_path:None,attachment_mapping:None });
        }
    }
    Err("".into())
}
