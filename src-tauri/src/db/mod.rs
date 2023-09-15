use rusqlite::{Connection, Result};
use std::{sync::{Arc,Mutex}, collections::HashMap, path::PathBuf};
use crate::{model::Config, utils};

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
  Ok(config_map)
}

pub fn config_set(config_map:HashMap<String,String>)->Result<()>{
  let conn=CONN.lock().unwrap();
  for config in config_map {
    conn.execute(
        "UPDATE config SET value=?1 where key=?2",
        (&config.0, &config.1),
    )?;
  }
  Ok(())
}




/*
#[derive(Debug)]
struct Person {
    id: i32,
    name: String,
    data: Option<Vec<u8>>,
}

fn main() -> Result<()> {
    let conn = Connection::open_in_memory()?;

    conn.execute(
        "CREATE TABLE person (
            id    INTEGER PRIMARY KEY,
            name  TEXT NOT NULL,
            data  BLOB
        )",
        (), // empty list of parameters.
    )?;
    let me = Person {
        id: 0,
        name: "Steven".to_string(),
        data: None,
    };
    conn.execute(
        "INSERT INTO person (name, data) VALUES (?1, ?2)",
        (&me.name, &me.data),
    )?;

    let mut stmt = conn.prepare("SELECT id, name, data FROM person")?;
    let person_iter = stmt.query_map([], |row| {
        Ok(Person {
            id: row.get(0)?,
            name: row.get(1)?,
            data: row.get(2)?,
        })
    })?;

    for person in person_iter {
        println!("Found person {:?}", person.unwrap());
    }
    Ok(())
}
 */