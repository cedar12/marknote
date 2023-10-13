use tauri::api::dialog::blocking::FileDialogBuilder;
use crate::cmd::file::{save_md,read_md};
use crate::resp;


#[tauri::command]
pub async fn save_as_md(md:&str,title: &str) ->Result<resp::Resp<String>,String> {
    let file_path = FileDialogBuilder::new().add_filter("Markdown", &["md"]).set_title(title).save_file();
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
pub async fn open_file(title: &str) ->Result<resp::Resp<String>,String> {
    let file_path = FileDialogBuilder::new().add_filter("Markdown", &["md"]).set_title(title).pick_file();
    if let Some(file_path)=file_path{
        if let Some(fp)=file_path.to_str(){
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