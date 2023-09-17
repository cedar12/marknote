use crate::{resp, utils};
use std::fs;



#[tauri::command]
pub fn read_md(path: &str) -> resp::Resp<String> {
    match fs::read_to_string(path) {
        Ok(data) => resp::data(Some(data)),
        Err(e) => resp::err(e.to_string()),
    }
}

#[tauri::command]
pub fn save_md(path: &str, md: &str) -> resp::Resp<String> {
    match fs::write(path, md) {
        Ok(_) => resp::data(None),
        Err(e) => resp::err(e.to_string()),
    }
}




#[tauri::command]
pub async fn save_image(path:&str,base64: &str) ->Result<resp::Resp<String>,String> {
  match utils::write_image(path.into(),base64.into()){
    Ok(())=>{
      Ok(resp::ok(path.into(),None))
    },
    Err(e)=>{
      println!("{:?}",e);
      Err("".into())
    }
  }
}

#[tauri::command]
pub fn save_image_path(md_path:&str,img_path: &str) ->Result<resp::Resp<String>,String> {
  match utils::save_image(md_path.into(),img_path.into()){
    Ok(save_path)=>{
      Ok(resp::ok(save_path,None))
    },
    Err(e)=>{
      println!("{:?}",e);
      Err("".into())
    }
  }
}

// #[tauri::command]
// async fn copy_image(path:&str) ->Result<resp::Resp<String>,String> {
//   match utils::write_image(path.into(),base64.into()){
//     Ok(())=>{
//       Ok(resp::ok(path.into(),None))
//     },
//     Err(e)=>{
//       println!("{:?}",e);
//       Err("".into())
//     }
//   }
// }