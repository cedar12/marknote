
use crate::utils::rule;

pub fn md_to_html(md:&str)->String{
  let parser = &mut markdown_it::MarkdownIt::new();
  rule::add(parser);
  let mut ast = parser.parse(md);
  // The WYSIWYG editor enables markdown-it's `breaks` option.
  ast.walk_mut(|node, _| {
    if node.is::<markdown_it::plugins::cmark::inline::newline::Softbreak>() {
      node.replace(EditorBreak);
    }
  });
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
  use super::md_to_html;

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
