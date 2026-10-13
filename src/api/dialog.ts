import { invoke } from "@tauri-apps/api/core";
import type { FileVersion, MarkdownFileResponse } from '../utils/fileVersion';
import { collectAttachmentReferences } from '../utils/attachments';
import type MarkdownIt from 'markdown-it';


export function saveAs(md:string,title:string,sourcePath:string|null=null,sourceVersion:FileVersion|null=null,parser?:MarkdownIt){
  return invoke<MarkdownFileResponse>('save_as_md',{title,md,sourcePath,sourceVersion,attachments:collectAttachmentReferences(md,parser)});
}

export function openFile(title:string){
  return invoke<MarkdownFileResponse>('open_file',{title:title});
}

