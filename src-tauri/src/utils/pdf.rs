use std::{path::Path, fs, time::Duration};

use headless_chrome::{types::{PrintToPdfOptions, TransferMode}, LaunchOptions, Browser};
use anyhow::{Result,anyhow};
use log::{debug, info};
use std::fmt::Debug;

fn print_to_pdf(
  file_path: &str,
  pdf_options: PrintToPdfOptions,
  launch_options: LaunchOptions,
) -> Result<Vec<u8>> {
  let browser = Browser::new(launch_options)?;
  let tab = browser.new_tab()?;
  let tab = tab.navigate_to(file_path)?.wait_until_navigated()?;

  debug!("Using PDF options: {:?}", pdf_options);
  let bytes = tab.print_to_pdf(Some(pdf_options))?;

  Ok(bytes)
}

pub fn html_to_pdf<I, O>(
  input: I,
  output: O,
  pdf_options: PrintToPdfOptions,
  launch_options: LaunchOptions
) -> Result<()>
where
  I: AsRef<Path> + Debug,
  O: AsRef<Path> + Debug,
{
  let os = input
      .as_ref()
      .as_os_str()
      .to_str()
      .ok_or_else(|| anyhow!("Invalid Input"))?;
  let input = format!("file://{os}");
  info!("Input file: {input}");

  let local_pdf = print_to_pdf(&input, pdf_options, launch_options)?;

  info!("Output file: {:?}", output.as_ref());
  fs::write(output.as_ref(), local_pdf)?;

  Ok(())
}

pub fn pdf_options()->PrintToPdfOptions{
  PrintToPdfOptions{
    display_header_footer: Some(true),
    print_background: Some(true),
    scale: Some(1.0),
    landscape: None,
    page_ranges: Some("1-100".to_string()),
    ignore_invalid_page_ranges: Some(true),
    header_template: Some("".to_string()),
    footer_template: Some("".to_string()),
    prefer_css_page_size: Some(true),
    margin_top: Some(0.0),
    margin_bottom: Some(0.0),
    margin_left: Some(0.0),
    margin_right: Some(0.0),
    paper_width:None,
    paper_height:None,
    transfer_mode:None,
  }
}

pub fn launch_options()->LaunchOptions<'static>{
  LaunchOptions{
    headless: true,
    sandbox: true,
    enable_gpu: true,
    enable_logging: false,
    window_size: Some((1920, 1080)),
    port: Some(9222),
    ignore_certificate_errors: true,
    path:None,
    user_data_dir:None,
    extensions:vec![],
    args:vec![],
    disable_default_args:false,
    idle_browser_timeout:Duration::from_secs(3000),
    process_envs:None,
    proxy_server:None,
  }
}