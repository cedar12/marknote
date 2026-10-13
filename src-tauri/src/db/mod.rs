use rusqlite::{Connection, OptionalExtension, Result};
use std::{sync::{Arc,Mutex}, collections::HashMap, path::PathBuf};
use crate::{model::Config, utils::{self, constant}};

fn get_db_path()->PathBuf{
  println!("app path: {:?}",utils::get_path());
  utils::get_path().join("marknote.db")
}

lazy_static! {
  static ref CONN: Arc<Mutex<Connection>>={
    let conn=Connection::open(get_db_path()).unwrap();
    init(&conn);
    Arc::new(Mutex::new(conn))
  };
}

fn init(conn:&Connection){
  conn.execute(
    "CREATE TABLE if not exists config (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
    )",
    (),
  ).unwrap();

  let count=count(conn,constant::config::IMAGE_SAVE_TYPE).unwrap();
  if count==0 {
    conn.execute("insert into config(key,value) values(?1,?2)", (constant::config::IMAGE_SAVE_TYPE,"default")).unwrap();
    conn.execute("insert into config(key,value) values(?1,?2)", (constant::config::IMAGE_SAVE_PATH,"${filename}.assets")).unwrap();
  }

}

fn count(conn:&Connection,key:&str)->Result<usize>{
  let count:usize=conn.query_row(
    "SELECT count(*) FROM config WHERE key=?1",
    [key],
    |row| row.get(0),
  )?;
  Ok(count)
}

pub fn config_map()->Result<HashMap<String,String>>{
  let conn=CONN.lock().unwrap();
  let mut stmt = conn.prepare("SELECT key,value FROM config")?;
  let config_iter = stmt.query_map([], |row| {
      Ok(Config {
          key: row.get(0)?,
          value: row.get(1)?,
      })
  })?;
  let mut config_map=HashMap::new();
  for config in config_iter {
    let config=config?.clone();
    config_map.insert(config.key, config.value);
  }
  println!("config map {:?}",config_map);
  Ok(config_map)
}

// Window preferences must remain best-effort even when the main config database
// is unavailable. Do not initialize the legacy panic-on-error connection here.
fn preference_connection() -> std::result::Result<Connection, String> {
  let folder = dirs_next::data_dir().ok_or("application data directory unavailable")?.join("com.github.marknote");
  std::fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
  let connection = Connection::open(folder.join("marknote.db")).map_err(|error| error.to_string())?;
  connection.busy_timeout(std::time::Duration::from_millis(250)).map_err(|error| error.to_string())?;
  Ok(connection)
}

pub fn config_get(key: &str) -> std::result::Result<Option<String>, String> {
  let conn = preference_connection()?;
  let exists: bool = conn.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='config')", [], |row| row.get(0)).map_err(|error| error.to_string())?;
  if !exists { return Ok(None); }
  conn.query_row("SELECT value FROM config WHERE key=?1", [key], |row| row.get(0)).optional().map_err(|error| error.to_string())
}

pub fn config_set_value(key: &str, value: &str) -> std::result::Result<(), String> {
  let conn = preference_connection()?;
  conn.execute("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL)", []).map_err(|error| error.to_string())?;
  conn.execute("INSERT INTO config(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key,value)).map_err(|error| error.to_string())?;
  Ok(())
}

pub fn config_set(config_map:HashMap<String,String>)->Result<()>{
  let conn=CONN.lock().unwrap();
  // println!("set config map {:?}",config_map);
  for config in config_map {
    let res:usize=conn.query_row(
      "SELECT count(*) FROM config WHERE key=?1",
      [config.0.clone()],
      |row| row.get(0),
    )?;
    if res>0 {
      conn.execute(
          "UPDATE config SET value=?1 where key=?2",
          (&config.1, &config.0),
      )?;
    }else{
      conn.execute("insert into config(key,value) values(?1,?2)", (&config.0,&config.1))?;
    }
    
  }
  Ok(())
}
