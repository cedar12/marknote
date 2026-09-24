//! Convert the editor's Markdown AST to an editable WordprocessingML package.
//! The package is assembled locally, so exporting never requires Word or a web service.

use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose, Engine as _};
use markdown_it::parser::inline::Text;
use markdown_it::plugins::cmark::block::{
    blockquote::Blockquote,
    code::CodeBlock,
    heading::ATXHeading,
    hr::ThematicBreak,
    lheading::SetextHeader,
    list::{BulletList, ListItem, OrderedList},
    paragraph::Paragraph,
};
use markdown_it::plugins::cmark::inline::{
    backticks::CodeInline,
    emphasis::{Em, Strong},
    image::Image,
    link::Link,
    newline::{Hardbreak, Softbreak},
};
use markdown_it::plugins::extra::{
    strikethrough::Strikethrough,
    tables::{Table, TableBody, TableCell, TableHead, TableRow},
};
use markdown_it::plugins::html::{html_block::HtmlBlock, html_inline::HtmlInline};
use markdown_it::Node;
use markdown_it_tasklist::TodoCheckbox;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::utils::rule::{
    self,
    fence::CodeFence,
    math::{InlineMath, Math},
};

const W_NS: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MAX_IMAGE_BYTES: u64 = 15 * 1024 * 1024;

#[derive(Clone, Copy, Default)]
struct RunStyle {
    bold: bool,
    italic: bool,
    strike: bool,
    code: bool,
    link: bool,
}

#[derive(Clone, Copy, Default)]
struct ParagraphStyle {
    heading: Option<u8>,
    quote_depth: u8,
    list: Option<(u32, u8)>,
    task_depth: Option<u8>,
    code: bool,
}

struct Relationship {
    id: u32,
    kind: &'static str,
    target: String,
    external: bool,
}

struct EmbeddedImage {
    name: String,
    data: Vec<u8>,
}

struct WordDocument {
    body: String,
    relationships: Vec<Relationship>,
    images: Vec<EmbeddedImage>,
    ordered_lists: Vec<(u32, u32, u8)>, // (numId, starting number, nesting depth)
    next_relationship_id: u32,
    next_number_id: u32,
    source_dir: Option<PathBuf>,
    diagram_images: HashMap<String, String>,
    equations: HashMap<String, String>,
    image_error: Option<anyhow::Error>,
}

impl WordDocument {
    fn new(source_path: Option<&str>, diagram_images: HashMap<String, String>, equations: HashMap<String, String>) -> Self {
        let source_dir = source_path
            .filter(|path| !path.is_empty())
            .and_then(|path| Path::new(path).parent().map(Path::to_path_buf));
        Self {
            body: String::new(),
            relationships: Vec::new(),
            images: Vec::new(),
            ordered_lists: Vec::new(),
            next_relationship_id: 3,
            next_number_id: 2,
            source_dir,
            diagram_images,
            equations,
            image_error: None,
        }
    }

    fn relationship(&mut self, kind: &'static str, target: String, external: bool) -> u32 {
        let id = self.next_relationship_id;
        self.next_relationship_id += 1;
        self.relationships.push(Relationship {
            id,
            kind,
            target,
            external,
        });
        id
    }

    fn render_blocks(&mut self, nodes: &[Node], quote_depth: u8) {
        for node in nodes {
            if let Some(heading) = node.cast::<ATXHeading>() {
                self.paragraph(
                    &node.children,
                    ParagraphStyle {
                        heading: Some(heading.level),
                        quote_depth,
                        ..Default::default()
                    },
                );
            } else if let Some(heading) = node.cast::<SetextHeader>() {
                self.paragraph(
                    &node.children,
                    ParagraphStyle {
                        heading: Some(heading.level),
                        quote_depth,
                        ..Default::default()
                    },
                );
            } else if node.is::<Paragraph>() {
                self.paragraph(
                    &node.children,
                    ParagraphStyle {
                        quote_depth,
                        ..Default::default()
                    },
                );
            } else if node.is::<Blockquote>() {
                self.render_blocks(&node.children, quote_depth.saturating_add(1));
            } else if node.is::<BulletList>() || node.is::<OrderedList>() {
                self.render_list(node, 0, quote_depth);
            } else if node.is::<Table>() {
                self.render_table(node);
            } else if let Some(code) = node.cast::<CodeFence>() {
                if code.info.split_whitespace().next() == Some("mermaid") {
                    let content = code.content.trim_end_matches('\n');
                    if let Some(source) = self.diagram_images.get(content).cloned() {
                        self.image_paragraph(&source, "Mermaid diagram", quote_depth);
                    }
                } else {
                    self.code_paragraph(&code.content, quote_depth);
                }
            } else if let Some(code) = node.cast::<CodeBlock>() {
                self.code_paragraph(&code.content, quote_depth);
            } else if let Some(math) = node.cast::<Math>() {
                self.equation_paragraph(math.content.trim_end(), quote_depth);
            } else if let Some(html) = node.cast::<HtmlBlock>() {
                // Raw HTML is source content in MarkNote. Keep it editable and visible.
                self.code_paragraph(&html.content, quote_depth);
            } else if node.is::<ThematicBreak>() {
                self.body.push_str("<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"8\" w:color=\"B9BEC4\"/></w:pBdr></w:pPr></w:p>");
            } else {
                self.render_blocks(&node.children, quote_depth);
            }
        }
    }

    fn render_list(&mut self, list: &Node, depth: u8, quote_depth: u8) {
        let num_id = if let Some(ordered) = list.cast::<OrderedList>() {
            let id = self.next_number_id;
            self.next_number_id += 1;
            self.ordered_lists.push((id, ordered.start, depth.min(8)));
            id
        } else {
            1 // Shared bullet definition.
        };
        for item in &list.children {
            if !item.is::<ListItem>() {
                continue;
            }
            let task = item.children.iter().any(|child| {
                child.is::<TodoCheckbox>()
                    || child.children.iter().any(|part| part.is::<TodoCheckbox>())
            });
            let list_style = if task {
                None
            } else {
                Some((num_id, depth.min(8)))
            };
            let task_depth = if task { Some(depth.min(8)) } else { None };
            let mut first = true;
            let loose_task = item.children.first().is_some_and(|node| node.is::<TodoCheckbox>())
                && item.children.get(1).is_some_and(|node| node.is::<Paragraph>());
            for (child_index, child) in item.children.iter().enumerate() {
                if loose_task && child_index == 0 {
                    let mut inline = vec![child];
                    inline.extend(item.children[1].children.iter());
                    self.paragraph_refs(
                        &inline,
                        ParagraphStyle {
                            quote_depth,
                            list: list_style,
                            task_depth,
                            ..Default::default()
                        },
                    );
                    first = false;
                    continue;
                }
                if loose_task && child_index == 1 {
                    continue;
                }
                if child.is::<BulletList>() || child.is::<OrderedList>() {
                    self.render_list(child, depth.saturating_add(1), quote_depth);
                } else if child.is::<Paragraph>() {
                    self.paragraph(
                        &child.children,
                        ParagraphStyle {
                            quote_depth,
                            list: if first { list_style } else { None },
                            task_depth: if first { task_depth } else { None },
                            ..Default::default()
                        },
                    );
                    first = false;
                } else if child.is::<Blockquote>() {
                    self.render_blocks(&child.children, quote_depth.saturating_add(1));
                    first = false;
                } else if first {
                    // Tight list items contain inline nodes without a Paragraph wrapper.
                    let inline: Vec<&Node> = item
                        .children
                        .iter()
                        .take_while(|n| !n.is::<BulletList>() && !n.is::<OrderedList>())
                        .collect();
                    self.paragraph_refs(
                        &inline,
                        ParagraphStyle {
                            quote_depth,
                            list: list_style,
                            task_depth,
                            ..Default::default()
                        },
                    );
                    first = false;
                }
            }
            if first {
                self.paragraph(
                    &[],
                    ParagraphStyle {
                        quote_depth,
                        list: list_style,
                        task_depth,
                        ..Default::default()
                    },
                );
            }
        }
    }

    fn render_table(&mut self, table: &Node) {
        let mut rows: Vec<(&Node, bool)> = Vec::new();
        for section in &table.children {
            let header = section.is::<TableHead>();
            if header || section.is::<TableBody>() {
                for row in &section.children {
                    if row.is::<TableRow>() {
                        rows.push((row, header));
                    }
                }
            } else if section.is::<TableRow>() {
                rows.push((section, false));
            }
        }
        if rows.is_empty() {
            return;
        }
        let columns = rows
            .iter()
            .map(|(row, _)| row.children.len())
            .max()
            .unwrap_or(1)
            .max(1);
        let cell_width = (9000 / columns).max(240);
        let mut xml = String::from("<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"C8CDD3\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"C8CDD3\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"C8CDD3\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"C8CDD3\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"C8CDD3\"/><w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"C8CDD3\"/></w:tblBorders></w:tblPr><w:tblGrid>");
        for _ in 0..columns {
            xml.push_str(&format!("<w:gridCol w:w=\"{cell_width}\"/>"));
        }
        xml.push_str("</w:tblGrid>");
        for (row, header) in rows {
            xml.push_str("<w:tr>");
            for cell in &row.children {
                if !cell.is::<TableCell>() {
                    continue;
                }
                xml.push_str(&format!(
                    "<w:tc><w:tcPr><w:tcW w:w=\"{cell_width}\" w:type=\"dxa\"/></w:tcPr><w:p>"
                ));
                if header {
                    xml.push_str("<w:pPr><w:shd w:fill=\"F1F3F5\"/></w:pPr>");
                }
                for part in &cell.children {
                    self.render_inline(
                        part,
                        RunStyle {
                            bold: header,
                            ..Default::default()
                        },
                        &mut xml,
                    );
                }
                xml.push_str("</w:p></w:tc>");
            }
            xml.push_str("</w:tr>");
        }
        xml.push_str("</w:tbl>");
        self.body.push_str(&xml);
    }

    fn paragraph(&mut self, children: &[Node], style: ParagraphStyle) {
        let children: Vec<&Node> = children.iter().collect();
        self.paragraph_refs(&children, style);
    }

    fn paragraph_refs(&mut self, children: &[&Node], style: ParagraphStyle) {
        let mut xml = String::from("<w:p>");
        xml.push_str(&paragraph_properties(style));
        for node in children {
            self.render_inline(node, RunStyle::default(), &mut xml);
        }
        xml.push_str("</w:p>");
        self.body.push_str(&xml);
    }

    fn code_paragraph(&mut self, content: &str, quote_depth: u8) {
        let mut xml = String::from("<w:p>");
        xml.push_str(&paragraph_properties(ParagraphStyle {
            code: true,
            quote_depth,
            ..Default::default()
        }));
        for (index, line) in content.trim_end_matches('\n').split('\n').enumerate() {
            if index > 0 {
                xml.push_str("<w:r><w:br/></w:r>");
            }
            xml.push_str(&text_run(
                line,
                RunStyle {
                    code: true,
                    ..Default::default()
                },
            ));
        }
        xml.push_str("</w:p>");
        self.body.push_str(&xml);
    }

    fn render_inline(&mut self, node: &Node, style: RunStyle, out: &mut String) {
        if let Some(text) = node.cast::<Text>() {
            out.push_str(&text_run(&text.content, style));
        } else if node.is::<Hardbreak>() || node.is::<Softbreak>() {
            out.push_str("<w:r><w:br/></w:r>");
        } else if node.is::<Strong>() {
            self.render_inline_children(
                node,
                RunStyle {
                    bold: true,
                    ..style
                },
                out,
            );
        } else if node.is::<Em>() {
            self.render_inline_children(
                node,
                RunStyle {
                    italic: true,
                    ..style
                },
                out,
            );
        } else if node.is::<Strikethrough>() {
            self.render_inline_children(
                node,
                RunStyle {
                    strike: true,
                    ..style
                },
                out,
            );
        } else if node.is::<CodeInline>() {
            self.render_inline_children(
                node,
                RunStyle {
                    code: true,
                    ..style
                },
                out,
            );
        } else if let Some(link) = node.cast::<Link>() {
            if link.url.starts_with("https://")
                || link.url.starts_with("http://")
                || link.url.starts_with("mailto:")
            {
                let id = self.relationship("hyperlink", link.url.clone(), true);
                out.push_str(&format!("<w:hyperlink r:id=\"rId{id}\">"));
                self.render_inline_children(
                    node,
                    RunStyle {
                        link: true,
                        ..style
                    },
                    out,
                );
                out.push_str("</w:hyperlink>");
            } else {
                self.render_inline_children(node, style, out);
            }
        } else if let Some(image) = node.cast::<Image>() {
            self.render_image(image, &node.collect_text(), out);
        } else if let Some(checkbox) = node.cast::<TodoCheckbox>() {
            out.push_str(&text_run(if checkbox.checked { "☑ " } else { "☐ " }, style));
        } else if let Some(math) = node.cast::<InlineMath>() {
            if let Some(equation) = self.equations.get(&math.content) {
                out.push_str(equation);
            }
        } else if let Some(math) = node.cast::<Math>() {
            if let Some(equation) = self.equations.get(math.content.trim_end()) {
                out.push_str(equation);
            }
        } else if let Some(html) = node.cast::<HtmlInline>() {
            // MarkNote accepts raw HTML; keep source tags visible rather than dropping them.
            out.push_str(&text_run(
                &html.content,
                RunStyle {
                    code: true,
                    ..style
                },
            ));
        } else {
            self.render_inline_children(node, style, out);
        }
    }

    fn render_inline_children(&mut self, node: &Node, style: RunStyle, out: &mut String) {
        for child in &node.children {
            self.render_inline(child, style, out);
        }
    }

    fn render_image(&mut self, image: &Image, alt: &str, out: &mut String) {
        self.render_image_source(&image.url, alt, out);
    }

    fn image_paragraph(&mut self, source: &str, alt: &str, quote_depth: u8) {
        let mut xml = String::from("<w:p>");
        xml.push_str(&paragraph_properties(ParagraphStyle {
            quote_depth,
            ..Default::default()
        }));
        self.render_image_source(source, alt, &mut xml);
        xml.push_str("</w:p>");
        self.body.push_str(&xml);
    }

    fn equation_paragraph(&mut self, content: &str, quote_depth: u8) {
        if let Some(equation) = self.equations.get(content) {
            let properties = paragraph_properties(ParagraphStyle {
                quote_depth,
                ..Default::default()
            });
            self.body.push_str(&format!("<w:p>{properties}<m:oMathPara>{equation}</m:oMathPara></w:p>"));
        }
    }

    fn render_image_source(&mut self, source: &str, alt: &str, out: &mut String) {
        match self.read_image(source) {
            Ok((data, width, height)) => {
                let image_id = self.images.len() + 1;
                let name = format!("image{image_id}.png");
                let rel_id = self.relationship("image", format!("media/{name}"), false);
                self.images.push(EmbeddedImage {
                    name: name.clone(),
                    data,
                });
                let pixel_width = width.max(1) as u64;
                let pixel_height = height.max(1) as u64;
                let cx = (pixel_width * 9525).min(5_600_000);
                let cy = (pixel_height * cx / pixel_width).max(1);
                let alt = escape_xml(alt);
                out.push_str(&format!("<w:r><w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"{cx}\" cy=\"{cy}\"/><wp:docPr id=\"{image_id}\" name=\"Image {image_id}\" descr=\"{alt}\"/><a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic><pic:nvPicPr><pic:cNvPr id=\"0\" name=\"{name}\"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"rId{rel_id}\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"{cx}\" cy=\"{cy}\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>"));
            }
            Err(error) => {
                if self.image_error.is_none() {
                    let image_name = if source.starts_with("data:") { alt } else { source };
                    self.image_error = Some(error.context(format!("Word export could not embed image: {image_name}")));
                }
            }
        }
    }

    fn read_image(&self, source: &str) -> Result<(Vec<u8>, u32, u32)> {
        let raw = if source.starts_with("data:image/") {
            let (_, encoded) = source.split_once(',').context("invalid image data URL")?;
            if encoded.len() as u64 > MAX_IMAGE_BYTES * 2 {
                return Err(anyhow!("image is too large"));
            }
            general_purpose::STANDARD
                .decode(encoded)
                .context("invalid base64 image")?
        } else if source.starts_with("https://") || source.starts_with("http://") {
            let client = reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(8))
                .build()?;
            let response = client.get(source).send()?.error_for_status()?;
            let mut raw = Vec::new();
            response.take(MAX_IMAGE_BYTES + 1).read_to_end(&mut raw)?;
            raw
        } else {
            let file_path = if source.starts_with("file://") {
                url::Url::parse(source)?
                    .to_file_path()
                    .map_err(|_| anyhow!("invalid file image URL"))?
            } else {
                let path = Path::new(source);
                if path.is_absolute() {
                    path.to_path_buf()
                } else {
                    self.source_dir
                        .as_deref()
                        .unwrap_or_else(|| Path::new("."))
                        .join(path)
                }
            };
            let metadata = std::fs::metadata(&file_path)?;
            if metadata.len() > MAX_IMAGE_BYTES {
                return Err(anyhow!("image is too large"));
            }
            std::fs::read(file_path)?
        };
        if raw.len() as u64 > MAX_IMAGE_BYTES {
            return Err(anyhow!("image is too large"));
        }
        let inspect = image::io::Reader::new(Cursor::new(&raw)).with_guessed_format()?;
        let (width, height) = inspect
            .into_dimensions()
            .context("unsupported image format")?;
        if width as u64 * height as u64 > 40_000_000 {
            return Err(anyhow!("image dimensions are too large"));
        }
        let mut reader = image::io::Reader::new(Cursor::new(&raw)).with_guessed_format()?;
        let mut limits = image::io::Limits::default();
        limits.max_alloc = Some(200 * 1024 * 1024);
        reader.limits(limits);
        let decoded = reader.decode()?;
        let mut png = Cursor::new(Vec::new());
        decoded.write_to(&mut png, image::ImageOutputFormat::Png)?;
        Ok((png.into_inner(), width, height))
    }

    fn numbering_xml(&self) -> String {
        let mut xml = format!("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:numbering xmlns:w=\"{W_NS}\">");
        for (abstract_id, kind) in [(0, "bullet"), (1, "decimal")] {
            xml.push_str(&format!("<w:abstractNum w:abstractNumId=\"{abstract_id}\"><w:multiLevelType w:val=\"multilevel\">"));
            xml.push_str("</w:multiLevelType>");
            for level in 0..9 {
                let label = if kind == "bullet" {
                    "•".to_owned()
                } else {
                    format!("%{}.", level + 1)
                };
                let indent = 720 + level * 360;
                xml.push_str(&format!("<w:lvl w:ilvl=\"{level}\"><w:start w:val=\"1\"/><w:numFmt w:val=\"{kind}\"/><w:lvlText w:val=\"{label}\"/><w:lvlJc w:val=\"left\"/><w:pPr><w:tabs><w:numTab w:val=\"num\" w:pos=\"{indent}\"/></w:tabs><w:ind w:left=\"{indent}\" w:hanging=\"360\"/></w:pPr></w:lvl>"));
            }
            xml.push_str("</w:abstractNum>");
        }
        xml.push_str("<w:num w:numId=\"1\"><w:abstractNumId w:val=\"0\"/></w:num>");
        for (num_id, start, depth) in &self.ordered_lists {
            xml.push_str(&format!("<w:num w:numId=\"{num_id}\"><w:abstractNumId w:val=\"1\"/><w:lvlOverride w:ilvl=\"{depth}\"><w:startOverride w:val=\"{start}\"/></w:lvlOverride></w:num>"));
        }
        xml.push_str("</w:numbering>");
        xml
    }

    fn document_xml(&self) -> String {
        let content = if self.body.is_empty() {
            "<w:p/>"
        } else {
            &self.body
        };
        format!("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"{W_NS}\" xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\" xmlns:r=\"{REL_NS}\" xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><w:body>{content}<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\" w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/></w:sectPr></w:body></w:document>")
    }

    fn relationships_xml(&self) -> String {
        let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering\" Target=\"numbering.xml\"/>");
        for relationship in &self.relationships {
            xml.push_str(&format!("<Relationship Id=\"rId{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/{}\" Target=\"{}\"{} />", relationship.id, relationship.kind, escape_xml(&relationship.target), if relationship.external { " TargetMode=\"External\"" } else { "" }));
        }
        xml.push_str("</Relationships>");
        xml
    }
}

fn paragraph_properties(style: ParagraphStyle) -> String {
    let mut xml = String::from("<w:pPr>");
    if let Some(level) = style.heading {
        xml.push_str(&format!(
            "<w:pStyle w:val=\"Heading{}\"/>",
            level.clamp(1, 6)
        ));
    }
    if style.code {
        xml.push_str("<w:pStyle w:val=\"CodeBlock\"/>");
    }
    if let Some((num_id, level)) = style.list {
        xml.push_str(&format!(
            "<w:numPr><w:ilvl w:val=\"{level}\"/><w:numId w:val=\"{num_id}\"/></w:numPr>"
        ));
    }
    if let Some(depth) = style.task_depth {
        let indent = 720 + u32::from(depth) * 360 + u32::from(style.quote_depth.min(4)) * 360;
        xml.push_str(&format!("<w:ind w:left=\"{indent}\" w:hanging=\"360\"/>"));
    }
    if style.quote_depth > 0 {
        if style.task_depth.is_none() {
            let indent = u32::from(style.quote_depth.min(4)) * 360;
            xml.push_str(&format!("<w:ind w:left=\"{indent}\"/>"));
        }
        xml.push_str("<w:pBdr><w:left w:val=\"single\" w:sz=\"16\" w:space=\"8\" w:color=\"8BA0B8\"/></w:pBdr>");
    }
    xml.push_str("</w:pPr>");
    xml
}

fn text_run(text: &str, style: RunStyle) -> String {
    let mut xml = String::from("<w:r>");
    if style.bold || style.italic || style.strike || style.code || style.link {
        xml.push_str("<w:rPr>");
        if style.bold {
            xml.push_str("<w:b/>");
        }
        if style.italic {
            xml.push_str("<w:i/>");
        }
        if style.strike {
            xml.push_str("<w:strike/>");
        }
        if style.code {
            xml.push_str(
                "<w:rFonts w:ascii=\"Consolas\" w:hAnsi=\"Consolas\"/><w:shd w:fill=\"F1F3F5\"/>",
            );
        }
        if style.link {
            xml.push_str("<w:color w:val=\"1E9FCA\"/><w:u w:val=\"single\"/>");
        }
        xml.push_str("</w:rPr>");
    }
    xml.push_str("<w:t xml:space=\"preserve\">");
    xml.push_str(&escape_xml(text));
    xml.push_str("</w:t></w:r>");
    xml
}

fn escape_xml(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => result.push_str("&amp;"),
            '<' => result.push_str("&lt;"),
            '>' => result.push_str("&gt;"),
            '"' => result.push_str("&quot;"),
            '\'' => result.push_str("&apos;"),
            '\u{9}' | '\u{A}' | '\u{D}' => result.push(ch),
            '\u{0}'..='\u{1F}' => (),
            '\u{FFFE}' | '\u{FFFF}' => (),
            _ => result.push(ch),
        }
    }
    result
}

const STYLES_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Microsoft YaHei"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="180"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="150"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="120" w:after="120"/><w:ind w:left="240" w:right="240"/><w:shd w:fill="F1F3F5"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>"#;

pub fn markdown_to_docx(markdown: &str, source_path: Option<&str>) -> Result<Vec<u8>> {
    markdown_to_docx_with_diagrams(markdown, source_path, HashMap::new())
}

pub fn collect_equations(markdown: &str) -> Vec<String> {
    let parser = &mut markdown_it::MarkdownIt::new();
    rule::add(parser);
    let ast = parser.parse(markdown);
    let mut equations = Vec::new();
    let mut seen = HashSet::new();
    fn visit(nodes: &[Node], equations: &mut Vec<String>, seen: &mut HashSet<String>) {
        for node in nodes {
            let content = if let Some(math) = node.cast::<InlineMath>() {
                Some(math.content.as_str())
            } else {
                node.cast::<Math>().map(|math| math.content.trim_end())
            };
            if let Some(content) = content {
                if seen.insert(content.to_owned()) {
                    equations.push(content.to_owned());
                }
            }
            visit(&node.children, equations, seen);
        }
    }
    visit(&ast.children, &mut equations, &mut seen);
    equations
}

pub fn markdown_to_docx_with_diagrams(
    markdown: &str,
    source_path: Option<&str>,
    diagram_images: HashMap<String, String>,
) -> Result<Vec<u8>> {
    markdown_to_docx_with_assets(markdown, source_path, diagram_images, HashMap::new())
}

pub fn markdown_to_docx_with_assets(
    markdown: &str,
    source_path: Option<&str>,
    diagram_images: HashMap<String, String>,
    equations: HashMap<String, String>,
) -> Result<Vec<u8>> {
    let parser = &mut markdown_it::MarkdownIt::new();
    rule::add(parser);
    let ast = parser.parse(markdown);
    fn check_diagrams(nodes: &[Node], images: &HashMap<String, String>) -> Result<()> {
        for node in nodes {
            if let Some(code) = node.cast::<CodeFence>() {
                if code.info.split_whitespace().next() == Some("mermaid")
                    && !images.contains_key(code.content.trim_end_matches('\n'))
                {
                    return Err(anyhow!("Mermaid diagram could not be rendered for Word export"));
                }
            }
            check_diagrams(&node.children, images)?;
        }
        Ok(())
    }
    check_diagrams(&ast.children, &diagram_images)?;
    for content in collect_equations(markdown) {
        if !equations.contains_key(&content) {
            return Err(anyhow!("Formula could not be converted for Word export"));
        }
    }
    let mut document = WordDocument::new(source_path, diagram_images, equations);
    document.render_blocks(&ast.children, 0);
    if let Some(error) = document.image_error.take() {
        return Err(error);
    }

    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    let mut add = |path: &str, bytes: &[u8]| -> Result<()> {
        zip.start_file(path, options)?;
        zip.write_all(bytes)?;
        Ok(())
    };
    add("[Content_Types].xml", b"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Default Extension=\"png\" ContentType=\"image/png\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/><Override PartName=\"/word/numbering.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml\"/></Types>")?;
    add("_rels/.rels", b"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>")?;
    add("word/document.xml", document.document_xml().as_bytes())?;
    add(
        "word/_rels/document.xml.rels",
        document.relationships_xml().as_bytes(),
    )?;
    add("word/styles.xml", STYLES_XML.as_bytes())?;
    add("word/numbering.xml", document.numbering_xml().as_bytes())?;
    for image in &document.images {
        add(&format!("word/media/{}", image.name), &image.data)?;
    }
    drop(add);
    Ok(zip.finish()?.into_inner())
}

#[cfg(test)]
mod tests {
    use super::{collect_equations, markdown_to_docx, markdown_to_docx_with_assets, markdown_to_docx_with_diagrams};
    use base64::{engine::general_purpose, Engine as _};
    use std::collections::HashMap;
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    #[test]
    fn exports_editable_markdown_and_embedded_image() {
        let folder = std::env::temp_dir().join(format!("marknote-docx-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let image_path = folder.join("image.png");
        image::RgbImage::from_pixel(160, 90, image::Rgb([20, 40, 60]))
            .save(&image_path)
            .unwrap();
        let source = folder.join("note.md");
        let markdown = "# 中文 & Title\n\n**Bold** and *italic* and ~~old~~ with [link](https://example.com/?a=1&b=2).\n\n- [x] done\n- [ ] next\n\n3. third\n4. fourth\n\n| Name | Value |\n|---|---|\n| A | B |\n\n```rust\nfn main() {}\n```\n\n![sample](image.png)";
        let bytes = markdown_to_docx(markdown, source.to_str()).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("<w:pStyle w:val=\"Heading1\"/>"));
        assert!(document.contains("中文 &amp; Title"));
        assert!(document.contains("<w:b/>"));
        assert!(document.contains("<w:i/>"));
        assert!(document.contains("<w:strike/>"));
        assert!(document.contains("<w:hyperlink r:id="));
        assert!(!document.contains("[link]("));
        assert!(document.contains("☑ "));
        assert!(document.contains("☐ "));
        assert!(document.contains("<w:numPr>"));
        assert!(document.contains("<w:tbl>"));
        assert!(document.contains("fn main() {}"));
        assert!(document.contains("<w:drawing>"));
        assert!(!document.contains("![sample]("));
        let mut image = Vec::new();
        zip.by_name("word/media/image1.png")
            .unwrap()
            .read_to_end(&mut image)
            .unwrap();
        assert!(image.starts_with(b"\x89PNG"));
        let mut rels = String::new();
        zip.by_name("word/_rels/document.xml.rels")
            .unwrap()
            .read_to_string(&mut rels)
            .unwrap();
        assert!(rels.contains("https://example.com/?a=1&amp;b=2"));
        assert!(rels.contains("media/image1.png"));
        let mut numbering = String::new();
        zip.by_name("word/numbering.xml")
            .unwrap()
            .read_to_string(&mut numbering)
            .unwrap();
        assert!(numbering.contains("<w:startOverride w:val=\"3\"/>"));
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn exports_empty_document_and_escapes_xml() {
        let bytes = markdown_to_docx("", None).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("<w:body><w:p/>"));
        drop(zip);
        let bytes = markdown_to_docx("A < B & C", None).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("A &lt; B &amp; C"));
    }

    #[test]
    fn rejects_unavailable_image_instead_of_exporting_markdown_source() {
        let result = markdown_to_docx("![diagram](missing-image.png)", None);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("missing-image.png"));
    }

    #[test]
    fn loose_task_items_are_exported_once() {
        let bytes = markdown_to_docx("- [x] first\n\n- [ ] second", None).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert_eq!(document.matches("first").count(), 1);
        assert_eq!(document.matches("second").count(), 1);
        assert_eq!(document.matches("☑ ").count(), 1);
        assert_eq!(document.matches("☐ ").count(), 1);
    }

    #[test]
    fn nested_ordered_list_keeps_its_start_number() {
        let bytes = markdown_to_docx("- parent\n\n  3. third\n  4. fourth", None).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut numbering = String::new();
        zip.by_name("word/numbering.xml")
            .unwrap()
            .read_to_string(&mut numbering)
            .unwrap();
        assert!(numbering.contains("<w:lvlOverride w:ilvl=\"1\"><w:startOverride w:val=\"3\"/>"), "{numbering}");
    }

    #[test]
    fn embeds_rendered_mermaid_and_keeps_other_code() {
        let mut png = Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(
            32,
            16,
            image::Rgb([255, 255, 255]),
        ))
            .write_to(&mut png, image::ImageOutputFormat::Png)
            .unwrap();
        let diagram = "flowchart TD\nA --> B";
        let data_url = format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(png.into_inner())
        );
        let markdown = format!("```mermaid\n{diagram}\n```\n\n```rust\nlet x = 1;\n```");
        let bytes = markdown_to_docx_with_diagrams(
            &markdown,
            None,
            HashMap::from([(diagram.to_owned(), data_url)]),
        )
        .unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("<w:drawing>"));
        assert!(!document.contains("flowchart TD"));
        assert!(!document.contains("```mermaid"));
        assert!(document.contains("let x = 1;"));
        let mut image = Vec::new();
        zip.by_name("word/media/image1.png")
            .unwrap()
            .read_to_end(&mut image)
            .unwrap();
        assert!(image.starts_with(b"\x89PNG"));
    }

    #[test]
    fn rejects_mermaid_without_a_rendered_image() {
        let result = markdown_to_docx("```mermaid\nflowchart TD\nA --> B\n```", None);
        assert!(result.is_err());
    }

    #[test]
    fn exports_native_inline_and_display_equations() {
        let markdown = "Inline $x^2$ and $\\frac{a}{b}$.\n\n$$\n\\sqrt{x}\n$$\n\n```text\n$not_math$\n```";
        let formulas = collect_equations(markdown);
        assert_eq!(formulas, vec![String::from("x^2"), String::from("\\frac{a}{b}"), String::from("\\sqrt{x}")]);
        let equations = HashMap::from([
            ("x^2".into(), "<m:oMath><m:sSup><m:e><m:r><m:t>x</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:oMath>".into()),
            ("\\frac{a}{b}".into(), "<m:oMath><m:f/></m:oMath>".into()),
            ("\\sqrt{x}".into(), "<m:oMath><m:rad/></m:oMath>".into()),
        ]);
        let bytes = markdown_to_docx_with_assets(markdown, None, HashMap::new(), equations).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml").unwrap().read_to_string(&mut document).unwrap();
        assert!(document.contains("xmlns:m=\"http://schemas.openxmlformats.org/officeDocument/2006/math\""));
        assert!(document.contains("<m:sSup>"));
        assert!(document.contains("<m:oMathPara><m:oMath><m:rad/>"));
        assert!(document.contains("$not_math$"));
        assert!(!document.contains("$x^2$"));
    }
}
