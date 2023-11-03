

use crate::{resp, utils};
use std::fs;

#[tauri::command(async)]
pub async fn read_md(path: &str) -> Result<resp::Resp<String>, String> {
    let start_time = std::time::Instant::now();
    match fs::read_to_string(path) {
        Ok(data) => {
            log::info!("读取{}耗时：{}毫秒",path, start_time.elapsed().as_millis());
            Ok(resp::data(Some(data)))
        },
        Err(e) => Ok(resp::err(e.to_string())),
    }
}
#[tauri::command]
pub async fn read_md_to_html(path: &str) -> Result<resp::Resp<String>, String> {
    let start_time = std::time::Instant::now();
    match fs::read_to_string(path) {
        Ok(data) => {
            let md=utils::md::md_to_html(data.as_str());
            log::info!("读取{}耗时：{}毫秒",path, start_time.elapsed().as_millis());
            Ok(resp::data(Some(md)))
        },
        Err(e) => Ok(resp::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn save_md(path: &str, md: &str) -> Result<resp::Resp<String>, String> {
    match fs::write(path, md) {
        Ok(_) => Ok(resp::data(None)),
        Err(e) => Ok(resp::err(e.to_string())),
    }
}

#[tauri::command]
pub async fn save_image(
    md_path: &str,
    filename: String,
    base64: &str,
) -> Result<resp::Resp<String>, String> {
    match utils::write_cache_image(filename, base64.into()) {
        Ok(path) => {
            match utils::save_image(md_path.into(), path.to_string_lossy().to_string()).await {
                Ok(save_path) => {
                    // 删除临时图片
                    fs::remove_file(path).unwrap();
                    Ok(resp::ok(save_path, None))
                }
                Err(e) => {
                    println!("{:?}", e);
                    Err(e.to_string())
                }
            }
        }
        Err(e) => {
            println!("{:?}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn save_image_path(md_path: &str, img_path: &str) -> Result<resp::Resp<String>, String> {
    match utils::save_image(md_path.into(), img_path.into()).await {
        Ok(save_path) => Ok(resp::ok(save_path, None)),
        Err(e) => {
            println!("{:?}", e);
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

const HTML_ROOT: &str = r#"
<html>
<style>
pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}/*!
Theme: nnfx light
Description: a theme inspired by Netscape Navigator/Firefox
Author: (c) 2020-2021 Jim Mason <jmason@ibinx.com>
Maintainer: @RocketMan
License: https://creativecommons.org/licenses/by-sa/4.0  CC BY-SA 4.0
Updated: 2021-05-17

@version 1.1.0
*/.hljs{background:#fff;color:#000}.language-xml .hljs-meta,.language-xml .hljs-meta-string{font-weight:700;font-style:italic;color:#48b}.hljs-comment,.hljs-quote{font-style:italic;color:#070}.hljs-built_in,.hljs-keyword,.hljs-name{color:#808}.hljs-attr,.hljs-name{font-weight:700}.hljs-string{font-weight:400}.hljs-code,.hljs-link,.hljs-meta .hljs-string,.hljs-number,.hljs-regexp,.hljs-string{color:#00f}.hljs-bullet,.hljs-symbol,.hljs-template-variable,.hljs-title,.hljs-variable{color:#f40}.hljs-class .hljs-title,.hljs-title.class_,.hljs-type{font-weight:700;color:#639}.hljs-attr,.hljs-function .hljs-title,.hljs-subst,.hljs-tag,.hljs-title.function_{color:#000}.hljs-formula{background-color:#eee;font-style:italic}.hljs-addition{background-color:#beb}.hljs-deletion{background-color:#fbb}.hljs-meta{color:#269}.hljs-section,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{font-weight:700;color:#48b}.hljs-selector-pseudo{font-style:italic}.hljs-doctag,.hljs-strong{font-weight:700}.hljs-emphasis{font-style:italic}
</style>
<style>.marknote{outline:none;padding:1rem 4rem;font-family:var(--fontFamily);color:var(--contentTextColor);background-color:var(--contentBackgroundColor);--editorHighlightBackgroundColor:var(--contentBackgroundColorActive);--editorHighlightTextColor:var(--contentTextColorActive)}.marknote>*+*{margin-top:.75em}.marknote a{color:var(--primaryTextColor,#00c4ff)}.marknote .bold-wrapper,.marknote .code-wrapper,.marknote .strike-wrapper,.marknote .italic-wrapper,.marknote .link-wrapper{color:var(--editorEchoTextColor,#ccc);user-select:none;-webkit-user-select:none}.marknote ul,.marknote ol{padding:0 1rem}.marknote ul{margin-left:.3em}.marknote ol{margin-left:.5em}.marknote h1{line-height:1.1;position:relative}.marknote h1::before{content:"H1";display:block;position:absolute;top:0;left:-22px;font-size:.4em;color:#abaeb1}.marknote h2{line-height:1.1;position:relative}.marknote h2::before{content:"H2";display:block;position:absolute;top:0;left:-22px;font-size:.4em;color:#abaeb1}.marknote h3{line-height:1.1;position:relative}.marknote h3::before{content:"H3";display:block;position:absolute;top:0;left:-22px;font-size:.4em;color:#abaeb1}.marknote h4{line-height:1.1;position:relative}.marknote h4::before{content:"H4";display:block;position:absolute;top:0;left:-22px;font-size:.4em;color:#abaeb1}.marknote h5{line-height:1.1;position:relative}.marknote h5::before{content:"H5";display:block;position:absolute;top:0;left:-22px;font-size:.4em;color:#abaeb1}.marknote h6{line-height:1.1;position:relative}.marknote h6::before{content:"H6";display:block;position:absolute;top:0;left:-22px;font-size:.4em;color:#abaeb1}.marknote code.inline{background-color:var(--editorHighlightBackgroundColor,#f1f3f5);color:var(--editorHighlightTextColor,#616161);padding:.2em .4em;font-size:70%;white-space:break-spaces;margin:0 .2em;border-radius:4px;font-family:"JetBrainsMono",monospace}.marknote img{max-width:100%;height:auto}.marknote blockquote{box-sizing:border-box;margin-top:0.75em !important;padding:0 1em;margin:0;border-left:0.25em solid var(--contentBorderColor,#1b3954);}.marknote blockquote p{box-sizing:border-box;margin:0;padding:0.4em;}.marknote hr{border:none;border-top:2px solid var(--contentBorderColor,#ccc);margin:2rem 0;}.marknote table{border-collapse:collapse;table-layout:fixed;width:100%;margin:0;--gripWidth:8px;--gripColor:var(--contentBorderColor,#f1f3f5);--gripColorActive:var(--contentTextColorHover,#616161)}.marknote table .grip-table,.marknote table .grip-row,.marknote table .grip-column{display:inline-block;position:absolute;cursor:pointer}.marknote table .grip-table.selected,.marknote table .grip-row.selected,.marknote table .grip-column.selected{background-color:var(--gripColorActive)}.marknote table .grip-table{top:calc(0px - (var(--gripWidth) + 2px));left:calc(0px - (var(--gripWidth) + 2px));width:var(--gripWidth);height:var(--gripWidth);background-color:var(--gripColor)}.marknote table .grip-row{top:0;left:calc(0px - (var(--gripWidth) + 2px));width:var(--gripWidth);height:100%;background-color:var(--gripColor)}.marknote table .grip-row.first{top:2px;height:calc(100% - var(--gripWidth)/2)}.marknote table .grip-column{top:calc(0px - (var(--gripWidth) + 2px));left:0;width:100%;height:var(--gripWidth);background-color:var(--gripColor)}.marknote table .grip-column.first{left:2px;width:calc(100% - var(--gripWidth)/2)}.marknote table td,.marknote table th{min-width:1em;border:1px solid var(--contentBackgroundColorActive,#ced4da);padding:3px 5px;vertical-align:top;box-sizing:border-box;position:relative}.marknote table td>*,.marknote table th>*{margin-bottom:0}.marknote table th{font-weight:bold;text-align:left;background-color:var(--editorHighlightBackgroundColor,#f1f3f5);color:var(--editorHighlightTextColor,#616161)}.marknote table .selectedCell:after{z-index:2;position:absolute;content:"";left:0;right:0;top:0;bottom:0;background:rgba(200,200,255,.4);pointer-events:none}.marknote table .column-resize-handle{position:absolute;right:-2px;top:0;bottom:-2px;width:4px;background-color:#adf;pointer-events:none}.marknote table p{margin:0}.marknote ul[data-type=taskList]{list-style:none;padding:0;padding-left:.2rem;margin:0;--bgColor:#0375FB;--borderColor:#fff}.marknote ul[data-type=taskList] p{margin:0}.marknote ul[data-type=taskList] li{display:flex;padding:.2em 0}.marknote ul[data-type=taskList] li>label{flex:0 0 auto;margin-right:.5rem;user-select:none;cursor:pointer;position:relative;width:14px;height:14px;border:2px solid var(--bgColor)}.marknote ul[data-type=taskList] li>label input[type=checkbox]{opacity:0}.marknote ul[data-type=taskList] li>label input[type=checkbox]:checked+span{width:14px;height:14px;display:inline-block;position:absolute;left:0;top:0;background-color:var(--bgColor)}.marknote ul[data-type=taskList] li>label input[type=checkbox]:checked+span::after{content:"";display:inline-block;width:5px;height:10px;border-top:2px solid var(--borderColor);border-left:2px solid var(--borderColor);background-color:var(--bgColor);transform:rotate(230deg);position:absolute;left:3px;top:-1px}.marknote ul[data-type=taskList] li>div{flex:1 1 auto}.marknote ul[data-type=taskList] li ul li,.marknote ul[data-type=taskList] li ol li{display:list-item}.marknote ul[data-type=taskList] li ul[data-type=taskList]>li{display:flex}.table-cell-tooltip{display:flex;flex-direction:column}.table-cell-tooltip>div,.table-cell-tooltip button{cursor:pointer;pointer-events:all}.table-cell-tooltip>div:hover,.table-cell-tooltip button:hover{background-color:#868b92}.tableWrapper{width:100%;overflow-x:auto;overflow-y:hidden;box-sizing:border-box}.tableWrapper.has-focus{padding:12px 0 0 12px}.tableWrapper table tr:first-child{font-weight:bold;text-align:left;background-color:#f1f3f5}.marknote-codeblock pre{padding:1em;white-space-collapse:unset;}.marknote-codeblock pre code{display:block;}.codeblock-wrapper,.katex-wrapper,.katex-html,.marknote-mermaid pre{display:none;}.mermaid-render{display:flex;justify-content: center;}p .marknote-image{display: inline-block;margin-left: .25em;}</style><div class="marknote">
"#;

#[tauri::command]
pub async fn export_html(path: &str, html: &str) -> Result<resp::Resp<String>, String> {
    let new_html = format!(
        "{}{}</div>
  </html>",
        HTML_ROOT, html
    );
    match fs::write(path, new_html) {
        Ok(()) => Ok(resp::ok(path.into(), None)),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn ls_md(path: &str) -> Result<resp::Resp<utils::PathInfo>, String> {
    if let Ok(mut path_info) = utils::PathInfo::new(path) {
        match utils::ls_path(&mut path_info) {
            Ok(()) => Ok(resp::ok(path.into(), Some(path_info))),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Ok(resp::err("".into()))
    }
}


#[tauri::command]
pub async fn export_image(
    path: String,
    base64: &str,
) -> Result<resp::Resp<String>, String> {
    match utils::write_image(path.clone(), base64.into()) {
        Ok(_) => {
            Ok(resp::ok(path, None))
        }
        Err(e) => {
            println!("{:?}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn export_pdf(
    path: String,
    html: &str,
) -> Result<resp::Resp<String>, String> {
    let mut cache=utils::get_cache_dir();
    cache.push("pdf.html");
    let cache_str=cache.to_str().unwrap();
    match export_html(cache_str, html.into()).await {
        Ok(resp) => {
            if resp.code==0{
                let result=match utils::pdf::html_to_pdf(cache.clone(), path.clone(), utils::pdf::pdf_options(), utils::pdf::launch_options()){
                    Ok(_) => Ok(resp::ok(path.into(), None)),
                    Err(e) => Err(e.to_string())
                };
                fs::remove_file(cache);
                return result;
            }
            Ok(resp)
        }
        Err(e) => {
            println!("{:?}", e);
            Err(e.to_string())
        }
    }
}