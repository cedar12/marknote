
#[tauri::command]
pub fn cmd_args()->Vec<String>{
  let args: Vec<String> = std::env::args().collect();
  args
}

#[tauri::command]
pub fn log_info(str:&str){
  log::info!("{}",str);
}
#[tauri::command]
pub fn log_error(str:&str){
  log::error!("{}",str);
}
#[tauri::command]
pub fn log_debug(str:&str){
  log::debug!("{}",str);
}