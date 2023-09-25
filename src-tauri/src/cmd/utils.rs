
#[tauri::command]
pub fn args()->Vec<String>{
  let args: Vec<String> = std::env::args().collect();
  args
}