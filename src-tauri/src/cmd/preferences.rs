use std::collections::HashMap;

use crate::{db, resp::{Resp, self}, utils::constant};



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