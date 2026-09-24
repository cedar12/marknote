use markdown_it::MarkdownIt;
use markdown_it::plugins::cmark::inline;
use markdown_it::plugins::cmark::block;
use markdown_it::plugins::{extra, html};

pub mod fence;
pub mod math;


pub fn add(md: &mut MarkdownIt) {
  inline::newline::add(md);
  block::code::add(md);
  fence::add(md);
  math::add(md);

  block::hr::add(md);
  
  inline::escape::add(md);
  inline::backticks::add(md);
  inline::emphasis::add(md);
  inline::link::add(md);
  inline::image::add(md);
  inline::autolink::add(md);
  inline::entity::add(md);

  
  block::blockquote::add(md);
  
  block::list::add(md);
  block::reference::add(md);
  block::heading::add(md);
  block::lheading::add(md);
  block::paragraph::add(md);

  // Match the editor's markdown-it options: raw HTML, GFM tables and strike,
  // without linkify, typographer or smart quotes.
  html::add(md);
  extra::strikethrough::add(md);
  extra::tables::add(md);
  markdown_it_tasklist::add(md);
}
