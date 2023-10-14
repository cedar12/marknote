
use tauri_plugin_dialog::{FileDialogBuilder, DialogExt};

use crate::cmd::file::{save_md,read_md};
use crate::resp;


#[tauri::command]
pub async fn save_as_md(handle: tauri::AppHandle,md:&str,title: &str) ->Result<resp::Resp<String>,String> {
    let dialog=handle.dialog();
    let file_path = FileDialogBuilder::new(dialog.clone()).add_filter("Markdown", &["md"]).set_title(title).blocking_save_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.to_str(){
            let filepath:String=fp.into();
            let resp=save_md(fp,md).await;
            match resp {
                Ok(mut resp) => {
                    resp.info=filepath;
                    return Ok(resp);
                },
                Err(_) => {},
            }
        }
    }
    Err("".into())
}


#[tauri::command]
pub async fn open_file(handle: tauri::AppHandle,title: &str) ->Result<resp::Resp<String>,String> {
    
    let file_path = FileDialogBuilder::new(handle.dialog().clone()).add_filter("Markdown", &["md"]).set_title(title).blocking_pick_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.path.to_str(){
            let resp=read_md(fp.into()).await;
            match resp {
                Ok(mut resp) => {
                    resp.info=fp.into();
                    return Ok(resp);
                },
                Err(_) => {},
            }
        }
    }
    Err("".into())
}