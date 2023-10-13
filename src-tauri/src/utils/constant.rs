

pub static IS_MACOS: bool = cfg!(target_os = "macos");

pub const WIDTH:f64=800f64;
pub const HEIGHT:f64=800f64;
pub const MIN_WIDTH:f64=500f64;
pub const MIN_HEIGTH:f64=400f64;


pub mod config{
  pub const IMAGE_SAVE_TYPE:&str="image_save_type";
  pub const IMAGE_SAVE_PATH:&str="image_save_path";
}
