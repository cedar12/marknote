use std::collections::HashMap;
use std::path::Path;
use std::process::Command;
use std::str::FromStr;
use std::{path::PathBuf, fs};

use anyhow::anyhow;
use reqwest::Client;
use tauri::Window;
use tauri::{api::path, Config};

use std::fs::File;
use std::io::{ Write};
use base64::{Engine as _, engine::general_purpose};
use chrono::Local;
use crate::{db, resp};

pub mod constant;
pub use constant::*;



pub fn set_shadow(win: Window) {
  if cfg!(windows) {
      window_shadows::set_shadow(&win, true).expect("Unsupported platform!");
  }
}


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

pub fn get_cache_dir()->PathBuf{
  match path::app_cache_dir(&Config::default()){
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

pub fn not_exists_create_dir_all<P: AsRef<Path>>(path: P)->std::io::Result<()>{
  let mut p=PathBuf::new();
  p.push(path);
  if !p.exists(){
    fs::create_dir_all(p.clone())?;
  }
  Ok(())
}

pub fn get_extension_from_filename(path: String) -> anyhow::Result<String> {
  match Path::new(&path).file_name() {
      Some(filename) => Ok(filename.to_string_lossy().to_string()),
      None => Err(anyhow!("not filename")),
  }
}

pub fn write_image(filename:String,base64:String)->anyhow::Result<PathBuf>{
  let split_str: Vec<&str> = base64.split(",").collect();

  let img_data = general_purpose::STANDARD
  .decode(split_str[1])?;
  
  let path=get_cache_dir().join(filename);
  println!("{:?}", path);
  let mut img_file = File::create(path.clone())?;
  img_file.write_all(&img_data)?;
  Ok(path)
}



pub enum ImageSaveType{
  /// 默认 
  /// markdown存储相对路径存储
  Default(Option<String>),
  /// 指定
  /// 绝对路径存储
  Sepc(String),
  /// PicGo图床
  /// PicGo安装路径 命令行上传
  /// 上传的图片路径
  PicGo(String),
} 

impl FromStr for ImageSaveType {
  type Err = String;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    let ss=s.split(",").collect::<Vec<&str>>();
    match ss[0].into() {
      "default"=>{
        if ss.len()>1{
          return Ok(ImageSaveType::Default(Some(String::from(ss[1]))));
        }
        Ok(ImageSaveType::Default(None))
      }
      "sepc"=>{
        Ok(ImageSaveType::Sepc(ss[1].to_string()))
      }
      "picgo"=>{
        Ok(ImageSaveType::PicGo(ss[1].to_string()))
      }
      _=>Err(s.to_string())
    }
  }
}

impl ToString for ImageSaveType {
  fn to_string(&self) -> String {
      match self {
          ImageSaveType::Default(path) => {
            if let Some(path)=path{
              return format!("default,{:?}",path)
            }
            "default".into()
          },
          ImageSaveType::Sepc(path) => format!("sepc,{:?}",path),
          ImageSaveType::PicGo(path)=> format!("picgo,{:?}",path)
      }
  }
}

pub fn get_save_image_type()->anyhow::Result<ImageSaveType>{
  let map=db::config_map()?;
  let save_type:ImageSaveType=match map.get(config::IMAGE_SAVE_TYPE){
    Some(t)=>{
      if let Some(path)=map.get(config::IMAGE_SAVE_PATH){
        let path=format!("{},{}",t,path);
        match ImageSaveType::from_str(path.as_str()){
          Ok(t)=>t,
          Err(e)=>return Err(anyhow!(e))
        }
      }else{
        ImageSaveType::Default(None)
      }
    }
    None=>{
      ImageSaveType::Default(None)
    }
  };
  Ok(save_type)
}

pub async fn save_image(md_path:String,image_path:String)->anyhow::Result<String>{
  let save_type=get_save_image_type()?;
  let mut now=Local::now().format("%Y%m%d%H%M%S.").to_string();
  let save_path=match save_type{
    ImageSaveType::Default(path)=>{
      let filename=get_extension_from_filename(image_path.clone())?;
      let md_filename=get_extension_from_filename(md_path.clone())?;
      let mut pb=PathBuf::from(md_path);
      pb.pop();
      let mut pb2=PathBuf::new();
      if let Some(path)=path{
        let path=path.replace("${filename}", &md_filename);
        pb.push(path.clone());
        pb2.push(path);
      }
      now.push_str(&filename);
      pb.push(now.clone());
      pb2.push(now);
      if let Some(p)=pb.parent(){
        not_exists_create_dir_all(p)?;
      }
      fs::copy(image_path.clone(),pb.clone())?;
      match pb2.to_str() {
          Some(p) => p.into(),
          None => return Err(anyhow!("path error")),
      }
    }
    ImageSaveType::Sepc(path)=>{
      not_exists_create_dir_all(path.clone())?;
      let filename=get_extension_from_filename(image_path.clone())?;
      let mut pb=PathBuf::from(path);
      now.push_str(&filename);
      pb.push(filename);
      fs::copy(image_path.clone(),pb.clone())?;
      match pb.to_str() {
          Some(p) => p.into(),
          None => return Err(anyhow!("path error")),
      }
    }
    ImageSaveType::PicGo(path)=>{
      if path.starts_with("http"){
        // "http://127.0.0.1:36677/upload"
        let res=upload_picgo(path.as_str(),image_path.as_str()).await?;
        if !res.success{
          return Err(anyhow!("Image upload failed"));
        }
        res.result[0].clone()
      }else{
        let program_path=match constant::IS_MACOS{
          true=>"/Applications/PicGo.app/Contents/MacOS/PicGo",
          false=>path.as_str()
        };
        let output = Command::new(program_path).arg("upload").arg(image_path).output()?;
        println!("上传PicGo图片 {:?}",output);
        "".into()
      }
    }
  };
  Ok(save_path)
}


async fn upload_picgo(url:&str,path:&str)->anyhow::Result<PicGoResp>{
  let client = Client::new();
  let mut json=HashMap::new();
  json.insert("list", vec![path]);
  let response = client.post(url)
      .json(&json)
      .send().await?;
  let resp:PicGoResp=response.json().await?;
  Ok(resp)
}

fn upload_picgo_blocking(url:&str,path:&str)->anyhow::Result<PicGoResp>{
  use reqwest::blocking::Client;
  let client = Client::new();
  let mut json=HashMap::new();
  json.insert("list", vec![path]);
  let response = client.post(url)
      .json(&json)
      .send()?;
  let resp:PicGoResp=response.json()?;
  Ok(resp)
}

#[derive(Debug,serde::Serialize,serde::Deserialize)]
pub struct PicGoResp{
  success:bool,
  result:Vec<String>,
}

#[test]
fn test_mac_picgo(){
  let image_path="/Users/cengxiangdong/Documents/test.png";
  let output = Command::new("/Applications/PicGo.app/Contents/MacOS/PicGo").arg(image_path).output().unwrap();
  
  println!("上传PicGo图片 {:?}",output);
  // let res=upload_picgo("http://127.0.0.1:36677/upload", image_path).unwrap();
  // println!("{:?}",res);
}