use serde::{Serialize, Deserialize};


#[derive(Serialize, Deserialize, Debug,Clone)]
pub struct Resp<T>{
    pub code:u8,
    pub info:String,
    pub data:Option<T>,
}

pub fn new<T>(code:u8,info:String,data:Option<T>)->Resp<T>{
  Resp { code: code, info: info, data: data }
}
pub fn err<T>(info:String)->Resp<T>{
  new(1,info,None)
}
pub fn ok<T>(info:String,data:Option<T>)->Resp<T>{
 new(0,info,data)
}
pub fn data<T>(data:Option<T>)->Resp<T>{
  ok("".into(),data)
}