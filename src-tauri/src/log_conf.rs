use log::LevelFilter;

use std::str::FromStr;
use std::time::Duration;
use cron::Schedule;
use chrono::Local;
use chrono::DateTime;
use std::thread;

use log4rs::{
    append::{console::ConsoleAppender, file::FileAppender},
    config::{Appender, Logger, Root},
    encode::pattern::PatternEncoder,
    Config, Handle,
};

use crate::utils;

const PATTERN_ENCODER: &str = "[marknote] {d(%Y-%m-%d %H:%M:%S)} - {l} - {t}:{L} - {m}{n}";
// const DATETIME_FORMAT: &str = "%Y%m%d%";
// const DATETIME_FORMAT: &str = "%Y%m%d%H%M%S";
// const CRON: &str = "0 0 0 * * * *";
const CRON: &str = "0 0 0 * * * *";


fn get_log_config() -> Config {
    let now: DateTime<Local> = Local::now();
    let formatted_date = now.format("%Y%m%d").to_string();
    let stdout = ConsoleAppender::builder()
        .encoder(Box::new(PatternEncoder::new(PATTERN_ENCODER)))
        .build();

    let mut log_dir=utils::get_log_dir();
    log_dir.push(format!("{}.log", formatted_date));
    
    let file = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new(PATTERN_ENCODER)))
        .build(log_dir)
        .unwrap();

    let level=from_env_level();

    let config = Config::builder()
        .appender(Appender::builder().build("stdout", Box::new(stdout)))
        .appender(Appender::builder().build("file", Box::new(file)))
        .logger(
            Logger::builder()
                .appender("file")
                .additive(true)
                .build("marknote", level),
        )
        .build(
            Root::builder()
                .appender("file")
                .appender("stdout")
                .build(level),
        )
        .unwrap();
    config
}


fn from_env_level()->LevelFilter{
    let log_level=std::env::var("MARKNOTE_LOG");
    match log_level{
        Ok(level)=>{
            match level.as_str() {
                "off"=>{
                    LevelFilter::Off
                },
                "error"=>{
                    LevelFilter::Error
                },
                "warn"=>{
                    LevelFilter::Warn
                },
                "info"=>{
                    LevelFilter::Info
                },
                "trace"=>{
                    LevelFilter::Trace
                },
                "debug"=>{
                    LevelFilter::Debug
                },
                _=>{
                    LevelFilter::Info
                }
            }
        }
        Err(_)=>LevelFilter::Info
    }
    
}

fn init_config() -> Handle {
    let config = get_log_config();
    log4rs::init_config(config).unwrap()
}


pub fn init() {
    let mut handle = init_config();
    thread::spawn(move ||{schedule_task(&mut handle)});
    
}



fn schedule_task(handle:&mut Handle) {
    // let schedule = Schedule::from_str("0/10 * * * * * *").unwrap();
    let schedule = Schedule::from_str(CRON).unwrap();

    loop {
        let now: DateTime<Local> = Local::now();
        let next = schedule.upcoming(Local).next().unwrap();

        let delay = next - now;
        let delay_millis=delay.num_milliseconds() as u64;
        std::thread::sleep(Duration::from_millis(delay_millis));
        if delay_millis>100{
            handle.set_config(get_log_config());
        }
    }
}