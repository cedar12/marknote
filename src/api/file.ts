import { invoke } from "@tauri-apps/api/tauri";

export function save(path:string,md:string){
  return invoke('save_md', { path: path, md: md });
}

export function read(path:string){
  return invoke('read_md', { path: path});
}


export function saveImage(mdPath:string,filename:string,base64:string){
  return invoke('save_image', { mdPath: mdPath,filename,base64:base64});
}

export function saveImagePath(mdPath:string,imgPath:string){
  return invoke('save_image_path', { mdPath,imgPath});
}