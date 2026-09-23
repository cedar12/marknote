
use crate::utils::rule;

pub fn md_to_html(md:&str)->String{
  let parser = &mut markdown_it::MarkdownIt::new();
  rule::add(parser);
  let ast  = parser.parse(md);
  ast.render()
}

#[test]
fn test_md_to_html(){
  let content=std::fs::read_to_string("D:\\marknote\\docs\\marknote.md").unwrap();
  let html=md_to_html(content.as_str());
  // let html=md_to_html(r#"
  // ```rust
  // pub fn main(){

  // }
  // ```
  // $$
  // a^n=2
  // $$
  // "#);
  println!("{}",html)
}