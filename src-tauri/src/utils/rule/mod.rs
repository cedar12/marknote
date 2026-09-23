use markdown_it::MarkdownIt;
use markdown_it::plugins::cmark::inline;
use markdown_it::plugins::cmark::block;
use markdown_it::plugins::extra;

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

  
  extra::add(md);
  markdown_it_tasklist::add(md);
}