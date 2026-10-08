
use crate::utils::rule;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct MarkdownOptions {
  pub html: bool,
  pub breaks: bool,
  pub linkify: bool,
  pub typographer: bool,
  pub tight_lists: bool,
  pub bullet_list_marker: String,
  pub transform_pasted_text: bool,
  pub transform_copied_text: bool,
}

impl Default for MarkdownOptions {
  fn default() -> Self {
    Self {
      html: true,
      breaks: true,
      linkify: false,
      typographer: false,
      tight_lists: true,
      bullet_list_marker: "-".to_string(),
      transform_pasted_text: false,
      transform_copied_text: false,
    }
  }
}

impl MarkdownOptions {
  pub fn validate(&self) -> Result<(), String> {
    if !["-", "*", "+"].contains(&self.bullet_list_marker.as_str()) {
      return Err("Invalid Markdown bullet list marker".to_string());
    }
    Ok(())
  }
}

pub fn md_to_html(md:&str)->String{
  md_to_html_with_options(md, &MarkdownOptions::default())
}

pub fn md_to_html_with_options(md: &str, options: &MarkdownOptions) -> String {
  let parser = &mut markdown_it::MarkdownIt::new();
  rule::add_with_options(parser, options);
  let mut ast = parser.parse(md);
  if options.breaks {
    ast.walk_mut(|node, _| {
      if node.is::<markdown_it::plugins::cmark::inline::newline::Softbreak>() {
        node.replace(EditorBreak);
      }
    });
  }
  ast.render()
}

#[derive(Debug)]
struct EditorBreak;

impl markdown_it::NodeValue for EditorBreak {
  fn render(&self, _: &markdown_it::Node, fmt: &mut dyn markdown_it::Renderer) {
    fmt.self_close("br", &[]);
    fmt.cr();
  }
}

#[cfg(test)]
mod tests {
  use super::{md_to_html, md_to_html_with_options, MarkdownOptions};

  #[test]
  fn respects_markdown_parsing_preferences() {
    let source = "A\nB\n\n<span>raw</span> https://example.com \"quotes\" (c) ...";
    let defaults = md_to_html(source);
    assert!(defaults.contains("A<br"));
    assert!(defaults.contains("<span>raw</span>"));
    assert!(!defaults.contains("href=\"https://example.com\""));
    assert!(defaults.contains("(c) ..."));

    let options = MarkdownOptions {
      html: false,
      breaks: false,
      linkify: true,
      typographer: true,
      ..MarkdownOptions::default()
    };
    let configured = md_to_html_with_options(source, &options);
    assert!(configured.contains("A\nB"), "{configured}");
    assert!(!configured.contains("<span>raw</span>"), "{configured}");
    assert!(configured.contains("&lt;span&gt;raw&lt;/span&gt;"), "{configured}");
    assert!(configured.contains("href=\"https://example.com\""), "{configured}");
    assert!(configured.contains("“quotes” © …"), "{configured}");
  }

  #[test]
  fn markdown_options_validate_and_round_trip() {
    let options: MarkdownOptions = serde_json::from_str(r#"{"bulletListMarker":"+","transformPastedText":true}"#).unwrap();
    assert!(options.validate().is_ok());
    assert!(options.html && options.breaks && options.tight_lists);
    assert!(options.transform_pasted_text);
    let json = serde_json::to_value(options).unwrap();
    assert_eq!(json["bulletListMarker"], "+");
    assert_eq!(json["transformPastedText"], true);
    let invalid = MarkdownOptions { bullet_list_marker: "x".to_string(), ..MarkdownOptions::default() };
    assert!(invalid.validate().is_err());
  }

  #[test]
  fn renders_editor_markdown_features() {
    let html = md_to_html("# 标题\n\nA\nB ~~old~~ **bold**\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n```rust\nfn main() {}\n```\n\n<span>raw</span>");
    assert!(html.contains("<h1>标题</h1>"));
    assert!(html.contains("A<br"));
    assert!(html.contains("<s>old</s>"));
    assert!(html.contains("<strong>bold</strong>"));
    assert!(html.contains("<table>"));
    assert!(html.contains("contains-task-list"));
    assert!(html.contains("language-rust"));
    assert!(html.contains("<span>raw</span>"));
  }

  #[test]
  fn renders_math_nodes_for_editor() {
    let html = md_to_html("Inline $a < b$ and `code $x$`.\n\n$$\nx^2 + y^2\n$$");
    assert!(html.contains("<span class=\"katex\"><annotation encoding=\"application/x-tex\">a &lt; b</annotation></span>"), "{html}");
    assert!(html.contains("<span class=\"katex-display\"><annotation encoding=\"application/x-tex\">x^2 + y^2\n</annotation></span>"), "{html}");
    assert!(html.contains("<code>code $x$</code>"), "{html}");
    let inline_display = md_to_html("$$x^2$$\n\nAfter");
    assert!(inline_display.contains("class=\"katex-display\""), "{inline_display}");
    assert!(inline_display.contains("<p>After</p>"), "{inline_display}");
    let unclosed = md_to_html("$$\nnot closed\n\n# After");
    assert!(unclosed.contains("<h1>After</h1>"), "{unclosed}");
  }

  #[test]
  fn renders_project_feature_document() {
    let source = include_str!("../../../docs/marknote.md");
    let html = md_to_html(source);
    assert!(html.contains("Markdown Syntax"));
    assert!(html.contains("class=\"contains-task-list\""));
    assert!(html.contains("<table>"));
    assert!(html.contains("class=\"katex-display\""));
    assert!(html.contains("class=\"katex\""));
  }
}
