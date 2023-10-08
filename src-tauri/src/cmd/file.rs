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
pub async fn save_image(md_path:&str,filename:String,base64: &str) ->Result<resp::Resp<String>,String> {
  match utils::write_image(filename,base64.into()){
    Ok(path)=>{
      match utils::save_image(md_path.into(),path.to_string_lossy().to_string()).await{
        Ok(save_path)=>{
          // 删除临时图片
          fs::remove_file(path).unwrap();
          Ok(resp::ok(save_path,None))
        },
        Err(e)=>{
          println!("{:?}",e);
          Err(e.to_string())
        }
      }
    },
    Err(e)=>{
      println!("{:?}",e);
      Err(e.to_string())
    }
  }
}

#[tauri::command]
pub async fn save_image_path(md_path:&str,img_path: &str) ->Result<resp::Resp<String>,String> {
  match utils::save_image(md_path.into(),img_path.into()).await{
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


#[tauri::command]
pub async fn export_html(path:&str,html: &str) ->Result<resp::Resp<String>,String> {
  match fs::write(path, html){
    Ok(())=>{
      Ok(resp::ok(path.into(),None))
    }
    Err(e)=>{
      Err(e.to_string())
    }
  }
  
}