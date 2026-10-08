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
