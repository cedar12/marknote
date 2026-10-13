
use std::path::Path;
use std::str::FromStr;
use std::{path::PathBuf, fs};

use anyhow::anyhow;

use tauri::WebviewWindow;





use crate::db;

pub mod constant;
pub use constant::*;

pub mod schema;
pub mod pdf;
pub mod md;
pub mod docx;
pub mod image_export;
pub mod attachments;
pub mod image_resources;
pub mod window_size;
pub mod open_arguments;
pub use image_resources::{save_image, write_cache_image};

pub mod rule;

pub fn set_shadow(_win: WebviewWindow) {
  // if cfg!(windows) {
  //     window_shadows::set_shadow(&win, true).expect("Unsupported platform!");
  // }
}


pub fn get_path()->PathBuf{
  
  match dirs_next::data_dir(){
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
  match dirs_next::cache_dir(){
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

pub fn get_log_dir()->PathBuf{
  match dirs_next::cache_dir(){
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
    let (kind,value)=s.split_once(',').map_or((s,None),|(kind,value)|(kind,Some(value)));
    match kind {
      "default"=>Ok(ImageSaveType::Default(value.filter(|v|!v.is_empty()).map(String::from))),
      "sepc"=>value.filter(|v|!v.is_empty())
        .map(|v|ImageSaveType::Sepc(v.to_string()))
        .ok_or_else(||"missing image save path".to_string()),
      "picgo"=>value.filter(|v|!v.is_empty())
        .map(|v|ImageSaveType::PicGo(v.to_string()))
        .ok_or_else(||"missing PicGo endpoint or executable".to_string()),
      _=>Err(format!("unknown image save type: {kind}"))
    }
  }
}

impl ToString for ImageSaveType {
  fn to_string(&self) -> String {
      match self {
          ImageSaveType::Default(path) => {
            if let Some(path)=path{
              return format!("default,{}",path)
            }
            "default".into()
          },
          ImageSaveType::Sepc(path) => format!("sepc,{}",path),
          ImageSaveType::PicGo(path)=> format!("picgo,{}",path)
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
        ImageSaveType::from_str(t).map_err(|error|anyhow!(error))?
      }
    }
    None=>{
      ImageSaveType::Default(None)
    }
  };
  Ok(save_type)
}

#[derive(Debug,Clone,serde::Serialize)]
pub struct PathInfo{
  pub path:String,
  pub dir:bool,
  pub file:bool,
  pub name:String,
  pub children:Vec<PathInfo>,
}

impl PathInfo{
  pub fn new(path:&str)->anyhow::Result<Self>{
    let root_meta=fs::metadata(path)?;
    let mut root_name=String::new();
    if let Some(name)=PathBuf::from(path).file_name(){
      root_name.push_str(name.to_str().unwrap_or_else(||""));
    }
    Ok(Self{
      path:path.clone().to_string(),
      dir:root_meta.is_dir(),
      file:root_meta.is_file(),
      name: root_name,
      children: vec![],
    })
  }
}


pub fn ls_depth_path(path_info: &mut PathInfo) -> anyhow::Result<()> {
  if path_info.dir{
    for child_dir in fs::read_dir(&path_info.path)? {
      let child=child_dir?;
      let file_type=child.file_type()?;
      if let Some(path) = child.path().to_str() {
        if  file_type.is_dir()||path.to_lowercase().ends_with(".md"){
          let mut child_path_info=PathInfo::new(path)?;
          ls_depth_path(&mut child_path_info)?;
          path_info.children.push(child_path_info);
        }
        
        
      }
    }
  }
  
  Ok(())
}


pub fn ls_path(path_info: &mut PathInfo) -> anyhow::Result<()> {
  if path_info.dir{
    for child_dir in fs::read_dir(&path_info.path)? {
      let child=child_dir?;
      let file_type=child.file_type()?;
      if let Some(path) = child.path().to_str() {
        if file_type.is_dir()||path.to_lowercase().ends_with(".md"){
          let child_path_info=PathInfo::new(path)?;
          path_info.children.push(child_path_info);
        }
        
      }
    }
  }
  path_info.children.sort_by_key(|k|k.file);
  Ok(())
}


#[test]
#[ignore = "developer-machine filesystem smoke test"]
fn test_all_path()->anyhow::Result<()>{
  let path="D:\\";
  let mut path_info=PathInfo::new(path)?;
  ls_path(&mut path_info)?;
  println!("{:?}",path_info);
  Ok(())
}


#[test]
fn test_json_schema()->anyhow::Result<()>{
  let str=fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/themes/light.json"))?;
  // println!("{:?}",str);
  schema::validate(str.as_str()).unwrap();
  Ok(())
}

#[test]
#[ignore = "requires a local Chromium/PDF environment"]
fn test_html2pdf()->anyhow::Result<()>{
  let input=PathBuf::from("D:\\marknote\\docs\\test.html");
  let output=PathBuf::from("D:\\marknote\\docs\\test.pdf");
  pdf::html_to_pdf(input, output, pdf::pdf_options(), pdf::launch_options())?;
  Ok(())
}


#[test]
#[ignore = "developer-machine fixture path"]
fn test_md2html()->anyhow::Result<()>{
  let content=std::fs::read_to_string("D:\\marknote\\docs\\marknote.md")?;
  let res=md::md_to_html(content.as_str());
  println!("{}",res);
  Ok(())
}

#[test]
fn image_save_type_rejects_missing_values(){
  assert!(ImageSaveType::from_str("sepc").is_err());
  assert!(ImageSaveType::from_str("picgo,").is_err());
  assert!(ImageSaveType::from_str("unknown,value").is_err());
}

#[test]
fn image_save_type_preserves_commas_in_value(){
  match ImageSaveType::from_str("sepc,C:\\images,archive").unwrap(){
    ImageSaveType::Sepc(path)=>assert_eq!(path,"C:\\images,archive"),
    _=>panic!("expected specified image path"),
  }
}
