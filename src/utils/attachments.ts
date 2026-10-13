import MarkdownIt from 'markdown-it';
import math from 'markdown-it-katex';

export interface AttachmentReference {
  start: number;
  end: number;
  source: string;
  key: string;
  prefix: string;
  title?: string;
  syntax: 'markdown' | 'html';
}

interface SourceReference extends AttachmentReference { characterStart: number; characterEnd: number }
const defaultParser = new MarkdownIt({ html: true }).use(math);
const validateLink = defaultParser.validateLink;
defaultParser.validateLink = source => /^file:\/\//i.test(source) || validateLink(source);
const encoder = new TextEncoder();

function decoded(source: string): string {
  try { return decodeURIComponent(source); } catch { return source; }
}

export function isLocalAttachment(source: string): boolean {
  if (/^file:\/\//i.test(source)) return true;
  return !!source && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(source.replace(/^[a-z]:[\\/]/i, '/'));
}

function htmlEntities(source: string): string {
  return source.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, value => {
    const named: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[value.toLowerCase()]) return named[value.toLowerCase()];
    const number = value[2].toLowerCase() === 'x' ? parseInt(value.slice(3, -1), 16) : parseInt(value.slice(2, -1), 10);
    return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : value;
  });
}

/** Locate actual image syntax, preserving code, formulas, links and all other source. */
function sourceReferences(markdown: string, parser: MarkdownIt = defaultParser): SourceReference[] {
  const environment: Record<string, unknown> = {};
  const tokens = parser.parse(markdown, environment);
  const lines = markdown.match(/.*?(?:\r\n|\n|\r|$)/g)?.filter(Boolean) || [];
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length);
  const rules = (parser.inline.ruler as unknown as { __rules__: { name: string; fn: (...args: any[]) => boolean }[] }).__rules__;
  const image = rules.find(rule => rule.name === 'image');
  const html = rules.find(rule => rule.name === 'html_inline');
  if (!image || !html) throw new Error('Image parser is unavailable');
  const originalImage = image.fn, originalHtml = html.fn;
  const found: SourceReference[] = [];
  let fragment = '', origin = 0;
  const addHtml = (source: string, start: number) => {
    const tag = /^<img\b/i.exec(source);
    if (!tag) return;
    const attribute = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    attribute.lastIndex = tag[0].length;
    for (let match = attribute.exec(source); match; match = attribute.exec(source)) {
      if (match[1].toLowerCase() !== 'src') continue;
      const raw = match[2] ?? match[3] ?? match[4];
      if (raw === undefined) break;
      const equals = match[0].indexOf('=');
      let position = equals + 1;
      while (/\s/.test(match[0][position] || '') && position < match[0].length) position++;
      if (/["']/.test(match[0][position])) position++;
      const key = htmlEntities(raw);
      if (isLocalAttachment(key)) found.push({ start: 0, end: 0, characterStart: start + match.index + position,
        characterEnd: start + match.index + position + raw.length, source: decoded(key), key, prefix: '', syntax: 'html' });
      break;
    }
  };
  parser.inline.ruler.at('image', (state: any, silent: boolean) => {
    const start = state.pos;
    const labelEnd = state.src === fragment ? parser.helpers.parseLinkLabel(state, start + 1, false) : -1;
    const accepted = originalImage(state, silent);
    if (accepted && !silent && state.src === fragment && labelEnd >= 0) {
      const token = state.tokens[state.tokens.length - 1];
      const key = token.attrGet('src') || '';
      if (isLocalAttachment(key)) found.push({ start: 0, end: 0, characterStart: origin + start, characterEnd: origin + state.pos,
        source: decoded(key), key, prefix: fragment.slice(start, labelEnd + 1), title: token.attrGet('title') || undefined, syntax: 'markdown' });
    }
    return accepted;
  });
  parser.inline.ruler.at('html_inline', (state: any, silent: boolean) => {
    const start = state.pos;
    const accepted = originalHtml(state, silent);
    if (accepted && !silent && state.src === fragment) addHtml(fragment.slice(start, state.pos), origin + start);
    return accepted;
  });
  try {
    const visited = new Set<string>();
    for (const token of tokens) {
      if (!token.map || !['inline', 'table_open', 'html_block'].includes(token.type)) continue;
      const [first, last] = token.map;
      const identity = `${first}:${last}`;
      if (visited.has(identity)) continue;
      visited.add(identity);
      origin = offsets[first];
      fragment = markdown.slice(origin, offsets[last]);
      if (token.type === 'html_block') {
        const tags = /<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
        const visible = fragment.replace(/<!--[\s\S]*?(?:-->|$)/g, comment => ' '.repeat(comment.length));
        for (let tag = tags.exec(visible); tag; tag = tags.exec(visible)) addHtml(tag[0], origin + tag.index);
      } else parser.inline.parse(fragment, parser, environment, []);
    }
  } finally {
    parser.inline.ruler.at('image', originalImage);
    parser.inline.ruler.at('html_inline', originalHtml);
  }
  const sorted = found.sort((a, b) => a.characterStart - b.characterStart).filter((item, index, all) => !index || item.characterStart >= all[index - 1].characterEnd);
  let character = 0, byte = 0;
  for (const item of sorted) {
    byte += encoder.encode(markdown.slice(character, item.characterStart)).length;
    item.start = byte;
    byte += encoder.encode(markdown.slice(item.characterStart, item.characterEnd)).length;
    item.end = byte;
    character = item.characterEnd;
  }
  return sorted;
}

export function collectAttachmentReferences(markdown: string, parser?: MarkdownIt): AttachmentReference[] {
  return sourceReferences(markdown, parser).map(({ characterStart: _start, characterEnd: _end, ...reference }) => reference);
}

interface AttachmentReplacement { from: number; to: number; text: string }
function attachmentReplacements(markdown: string, mapping: Record<string, string>, parser?: MarkdownIt): AttachmentReplacement[] {
  if (!Object.keys(mapping).length) return [];
  const replacements: AttachmentReplacement[] = [];
  for (const reference of sourceReferences(markdown, parser)) {
    const destination = Object.prototype.hasOwnProperty.call(mapping,reference.key) ? mapping[reference.key]
      : Object.prototype.hasOwnProperty.call(mapping,reference.source) ? mapping[reference.source] : undefined;
    if (!destination) continue;
    const title = reference.title ? ` "${reference.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : '';
    replacements.push({ from: reference.characterStart, to: reference.characterEnd,
      text: reference.syntax === 'html' ? destination : `${reference.prefix}(<${destination}>${title})` });
  }
  return replacements;
}

export function rebaseMarkdownAttachments(markdown: string, mapping: Record<string, string>, parser?: MarkdownIt): string {
  let result = '', start = 0;
  for (const replacement of attachmentReplacements(markdown, mapping, parser)) {
    result += markdown.slice(start, replacement.from) + replacement.text;
    start = replacement.to;
  }
  return result + markdown.slice(start);
}

/** Map source caret/history UTF-16 positions through the exact attachment rewrite.
 * Prefix parsing cannot resolve an image reference whose definition follows the caret. */
export function rebaseMarkdownAttachmentOffsets(markdown: string, mapping: Record<string, string>, offsets: number[], parser?: MarkdownIt): number[] {
  const replacements = attachmentReplacements(markdown, mapping, parser);
  const deltas: number[] = [];
  let delta = 0;
  for (const replacement of replacements) {
    deltas.push(delta);
    delta += replacement.text.length - (replacement.to - replacement.from);
  }
  return offsets.map(value => {
    const offset = Math.max(0, Math.min(markdown.length, Number.isFinite(value) ? Math.floor(value) : 0));
    let low = 0, high = replacements.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (replacements[middle].to < offset) low = middle + 1;
      else high = middle;
    }
    if (low === replacements.length) return offset + delta;
    const replacement = replacements[low];
    const start = replacement.from + deltas[low];
    if (offset <= replacement.from) return offset + deltas[low];
    if (offset === replacement.to) return start + replacement.text.length;
    return start + Math.min(offset - replacement.from, replacement.text.length);
  });
}
