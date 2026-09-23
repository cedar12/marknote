//! Code fence
//!
//! ` ```lang ` or `~~~lang`
//!
//! <https://spec.commonmark.org/0.30/#code-fence>
use markdown_it::parser::block::{BlockRule, BlockState};
use markdown_it::parser::inline::{InlineRule, InlineState};
use markdown_it::{MarkdownIt, Node, NodeValue, Renderer};

#[derive(Debug)]
pub struct Math {
    pub content: String,
}

impl NodeValue for Math {
    fn render(&self, _node: &Node, fmt: &mut dyn Renderer) {
        
        // let mut attrs = node.attrs.clone();

        fmt.cr();
        fmt.open("span", &[("class","katex-display".into())]);
        //katex parser
        fmt.open("annotation", &[("encoding","application/x-tex".into())]);
        fmt.text(&self.content);
        fmt.close("annotation");
        fmt.close("span");
        fmt.cr();
    }
}



pub fn add(md: &mut MarkdownIt) {
    md.block.add_rule::<MathScanner>();
    md.inline.add_rule::<InlineMathScanner>();
}

#[derive(Debug)]
pub struct InlineMath {
    pub content: String,
}

impl NodeValue for InlineMath {
    fn render(&self, _: &Node, fmt: &mut dyn Renderer) {
        fmt.open("span", &[("class", "katex".into())]);
        fmt.open("annotation", &[("encoding", "application/x-tex".into())]);
        fmt.text(&self.content);
        fmt.close("annotation");
        fmt.close("span");
    }
}

pub struct InlineMathScanner;

impl InlineRule for InlineMathScanner {
    const MARKER: char = '$';

    fn run(state: &mut InlineState) -> Option<(Node, usize)> {
        let input = &state.src[state.pos..state.pos_max];
        if !input.starts_with('$') {
            return None;
        }
        let display = input.starts_with("$$");
        let marker = if display { "$$" } else { "$" };
        let rest = &input[marker.len()..];
        if rest.starts_with(char::is_whitespace) {
            return None;
        }
        let mut escaped = false;
        for (offset, ch) in rest.char_indices() {
            if ch == '\n' { break; }
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if rest[offset..].starts_with(marker) {
                let content = &rest[..offset];
                if content.is_empty() || content.ends_with(char::is_whitespace) {
                    return None;
                }
                let node = if display {
                    Node::new(Math { content: content.to_string() })
                } else {
                    Node::new(InlineMath { content: content.to_string() })
                };
                return Some((node, offset + marker.len() * 2));
            }
        }
        None
    }
}


#[doc(hidden)]
pub struct MathScanner;

impl BlockRule for MathScanner {
  

    fn run(state: &mut BlockState) -> Option<(Node, usize)> {

        let marker="$$";
        
        let mut next_line = state.line;

        let line=state.get_line(next_line).trim();
        if line != marker {
            return None;
        }

        let mut have_end_marker = false;

        let mark='$';
        // search end of block
        'outer: loop {
            next_line += 1;
            if next_line >= state.line_max {
                // unclosed block should be autoclosed by end of document.
                // also block seems to be autoclosed by end of parent
                break;
            }

            let line = state.get_line(next_line);

            if !line.is_empty() && state.line_indent(next_line) < 0 {
                // non-empty line with negative indent should stop the list:
                // - ```
                //  test
                break;
            }

            let mut chars = line.chars().peekable();

            if Some(mark) != chars.next() { continue; }

            if state.line_indent(next_line) >= state.md.max_indent {
                continue;
            }

            // scan marker length
            let mut len_end = 1;
            while Some(&mark) == chars.peek() {
                chars.next();
                len_end += 1;
            }

            // closing code fence must be at least as long as the opening one
            if len_end < 2 { continue; }

            // make sure tail has spaces only
            loop {
                match chars.next() {
                    Some(' ' | '\t') => {},
                    Some(_) => continue 'outer,
                    None => {
                        have_end_marker = true;
                        break 'outer;
                    }
                }
            }
        }

        if !have_end_marker {
            return None;
        }

        // If a fence has heading spaces, they should be removed from its inner block
        let indent = state.line_offsets[state.line].indent_nonspace;
        let (content, _) = state.get_lines(state.line + 1, next_line, indent as usize, true);
        let node = Node::new(Math {
            content,
        });
        Some((node, next_line - state.line + if have_end_marker { 1 } else { 0 }))
    }
}
