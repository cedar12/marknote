import { invoke } from "@tauri-apps/api/core";
import type { FileVersion, MarkdownFileResponse } from '../utils/fileVersion';

export function save(path:string,md:string,expectedVersion:FileVersion|null=null){
  return invoke<MarkdownFileResponse>('save_md', { path, md, expectedVersion });
}

export function read(path:string){
  return invoke<MarkdownFileResponse>('read_md', { path: path});
}
export function probeFileVersion(path:string,baseline:FileVersion|null,full=false){
  return invoke<MarkdownFileResponse>('probe_file_version',{path,baseline,full});
}
export function readToHTML(path:string){
  return invoke('read_md_to_html', { path: path});
}


export function saveImage(mdPath:string|null,filename:string,base64:string){
  return invoke('save_image', { mdPath: mdPath,filename,base64:base64});
}

export function saveImagePath(mdPath:string|null,imgPath:string){
  return invoke('save_image_path', { mdPath,imgPath});
}

export function exportHTML(path:string,html:string){
  return invoke('export_html', { path,html});
}
export function exportImage(path:string,base64:string){
  return invoke('export_image', { path,base64});
}
export function exportPDF(path:string,html:string){
  return invoke('export_pdf', { path,html});
}
export function collectWordEquations(markdown:string):Promise<string[]>{
  return invoke('collect_word_equations', { markdown });
}
export function exportWord(path:string,markdown:string,sourcePath:string|null,diagramImages:Record<string,string>,equations:Record<string,string>){
  return invoke('export_word', { path,markdown,sourcePath,diagramImages,equations });
}


export function ls(path:string){
  return invoke('ls_md', { path});
}
