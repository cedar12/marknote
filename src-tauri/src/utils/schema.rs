use anyhow::Ok;
use jsonschema::JSONSchema;
use serde_json::{json, Value};

fn get_schema() -> Value {
    json!(
    {
      "type": "object",
      "properties": {
        "label": {
          "type":"string",
          "title":"主题标签",
        },
        "value": {
          "type":"string",
          "title":"主题值",
        },
        "type": {
          "type":"string",
          "title": "主题类型",
          "enum":["light","dark"]
        },
        "style": {
          "type":"object",
          "title": "主题样式",
          "properties": {
            "primaryBackgroundColor": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "primaryBackgroundColorHover": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "primaryBackgroundColorActive": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentBackgroundColor": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "primaryTextColor": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "primaryTextColorHover": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "primaryTextColorActive": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentTextColor": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "primaryBorderColor": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentBorderColor": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentBackgroundColorActive": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentBackgroundColorHover": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentTextColorActive": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            },
            "contentTextColorHover": {
              "type":"string",
              "pattern":"^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
            }
          }
        }
      }
    })
}
pub fn validate(json_str: &str) -> anyhow::Result<()> {
    let schema = get_schema();
    // println!("{:?}", schema);
    let instance = serde_json::from_str(json_str)?;
    let compiled = JSONSchema::compile(&schema);
    match compiled {
        core::result::Result::Ok(compiled) => {
            let result = compiled.validate(&instance);
            if let Err(errors) = result {
                for error in errors {
                    return Err(anyhow::anyhow!("{:?}", error));
                    // println!("Validation error: {}", error);
                    // println!(
                    //     "Instance path: {}", error.instance_path
                    // );
                }
            }
        }
        Err(error) => {
            return Err(anyhow::anyhow!("compile error: {}", error));
        }
    };

    Ok(())
}
