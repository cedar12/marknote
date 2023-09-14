use std::{path::PathBuf, fs};

use tauri::{api::path::{self, resolve_path, BaseDirectory}, Config, Env};

use std::fs::File;
use std::io::{self, Write};
use base64::{Engine as _, alphabet, engine::{self, general_purpose}};

pub fn get_path()->PathBuf{
  match path::app_data_dir(&Config::default()){
    Some(p)=>{
      let p=p.join("com.github.marknote");
      if !p.exists(){
        fs::create_dir_all(p.clone()).unwrap();
      }
      p
    },
    None=>PathBuf::new()
  }
  
}

pub fn write_image(path:String,base64:String)->anyhow::Result<()>{
  let split_str: Vec<&str> = base64.split(",").collect();

  let img_data = general_purpose::STANDARD
  .decode(split_str[1])?;
  // println!("{:?}", img_data);
  let mut img_file = File::create(path)?;
  img_file.write_all(&img_data)?;
  Ok(())
}