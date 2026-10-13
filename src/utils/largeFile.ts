import MarkdownIt from 'markdown-it';

export const LARGE_FILE_THRESHOLD = 512 * 1024;
export const SEGMENT_TARGET_SIZE = 128 * 1024;

interface MarkdownBlockToken {
  type: string;
  level: number;
  map: [number, number] | null;
  content: string;
}

interface MarkdownReferences {
  references?: Record<string, { href: string; title: string }>;
}

export interface MarkdownSegmentParser {
  parse(content: string, environment: MarkdownReferences): MarkdownBlockToken[];
}

const defaultParser = new MarkdownIt({ html: true });

function serializeReferences(environment: MarkdownReferences): string {
  return Object.entries(environment.references || {}).map(([label, reference]) => {
    // The normalized label retains any original bracket escapes. Escaping it
    // again would give the definition a different Markdown reference identity.
    const destination = reference.href.replace(/[\\<>]/g, '\\$&');
    const title = reference.title ? ` "${reference.title.replace(/[\\"]/g, '\\$&')}"` : '';
    return `[${label}]: <${destination}>${title}`;
  }).join('\n');
}

export function markdownReferenceDefinitions(content: string, parser: MarkdownSegmentParser = defaultParser): string {
  const environment: MarkdownReferences = {};
  parser.parse(content, environment);
  return serializeReferences(environment);
}

/** Give a renderer document-wide definitions without adding them to saved source. */
export function withMarkdownReferences(content: string, definitions: string): string {
  return definitions ? `${definitions}\n\n${content}` : content;
}

/** Reference definitions have no editor nodes, but must survive edits to their segment. */
export function preserveMarkdownReferences(markdown: string, original: string, parser: MarkdownSegmentParser = defaultParser): string {
  const originalEnvironment: MarkdownReferences = {};
  const currentEnvironment: MarkdownReferences = {};
  parser.parse(original, originalEnvironment);
  parser.parse(markdown, currentEnvironment);
  const missing = Object.fromEntries(Object.entries(originalEnvironment.references || {})
    .filter(([label]) => !Object.prototype.hasOwnProperty.call(currentEnvironment.references || {}, label)));
  const definitions = serializeReferences({ references: missing });
  return definitions ? `${markdown.replace(/(?:\r\n|\n|\r)+$/, '')}\n\n${definitions}` : markdown;
}

export function utf8ByteLength(content: string): number {
  let bytes = 0;
  for (const character of content) {
    const codePoint = character.codePointAt(0) || 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * Split only between complete top-level Markdown blocks. In particular, a
 * blank line inside a list, blockquote, code block or HTML container is unsafe.
 * Every character remains in exactly one segment, so an untouched large file
 * can be saved byte-for-byte (after the platform's UTF-8 decode/encode).
 */
export function prepareMarkdownSegments(content: string, targetSize = SEGMENT_TARGET_SIZE, parser: MarkdownSegmentParser = defaultParser): { segments: string[]; references: string } {
  const environment: MarkdownReferences = {};
  const tokens = parser.parse(content, environment);
  const references = serializeReferences(environment);
  if (content.length <= targetSize) return { segments: [content], references };
  const lines = content.match(/.*?(?:\r\n|\n|\r|$)/g)?.filter(Boolean) || [content];
  const offsets = [0];
  for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length);
  const protectedBlocks = tokens.filter(token => token.level === 0 && token.map).map(token => token.map!);

  // HTML's DOM containers can span several Markdown tokens separated by blank
  // lines. Keep their opening and closing tags in the same rendered segment.
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const token of tokens) {
    if (token.level !== 0 || token.type !== 'html_block' || !token.map) continue;
    const opening = token.content.match(/^\s*<([a-z][\w-]*)\b[^>]*>/i);
    if (!opening || /\/\s*>$/.test(opening[0]) || voidTags.has(opening[1].toLowerCase())) continue;
    const tag = opening[1];
    const tags = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    const start = token.map[0];
    tags.lastIndex = offsets[start];
    let depth = 0;
    let endOffset = content.length;
    for (let match = tags.exec(content); match; match = tags.exec(content)) {
      if (!/\/\s*>$/.test(match[0])) depth += match[1] ? -1 : 1;
      if (depth === 0) {
        endOffset = tags.lastIndex;
        break;
      }
    }
    let end = token.map[1];
    while (end < lines.length && offsets[end] < endOffset) end += 1;
    protectedBlocks.push([start, end]);
  }

  // The fallback parser has no math plugin (the editor supplies its parser).
  // Protect display math even when a document arrives before editor creation.
  for (let start = 0; parser === defaultParser && start < lines.length; start += 1) {
    if (!/^ {0,3}\$\$/.test(lines[start])) continue;
    if (tokens.some(token => ['fence', 'code_block', 'html_block'].includes(token.type) && token.map && token.map[0] <= start && start < token.map[1])) continue;
    if (lines[start].trim().slice(2).endsWith('$$')) continue;
    let end = start + 1;
    while (end < lines.length && !lines[end].trimEnd().endsWith('$$')) end += 1;
    if (end < lines.length) {
      protectedBlocks.push([start, end + 1]);
      start = end;
    }
  }
  protectedBlocks.sort((first, second) => first[0] - second[0]);
  const segments: string[] = [];
  let segmentStart = 0;
  let blockIndex = 0;
  let protectedUntil = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const boundary = index + 1;
    while (blockIndex < protectedBlocks.length && protectedBlocks[blockIndex][0] < boundary) {
      protectedUntil = Math.max(protectedUntil, protectedBlocks[blockIndex][1]);
      blockIndex += 1;
    }
    if (boundary >= protectedUntil && /^\s*(?:\r\n|\n|\r)$/.test(lines[index]) && offsets[boundary] - segmentStart >= targetSize) {
      segments.push(content.slice(segmentStart, offsets[boundary]));
      segmentStart = offsets[boundary];
    }
  }
  if (segmentStart < content.length || !segments.length) segments.push(content.slice(segmentStart));
  return { segments, references };
}

export function splitMarkdownIntoSegments(content: string, targetSize = SEGMENT_TARGET_SIZE, parser: MarkdownSegmentParser = defaultParser): string[] {
  if (content.length <= targetSize) return [content];
  return prepareMarkdownSegments(content, targetSize, parser).segments;
}

export function preserveBoundaryNewlines(markdown: string, original: string): string {
  const trailing = original.match(/(?:\r\n|\n|\r)+$/)?.[0] || '';
  if (!trailing) return markdown;
  return markdown.replace(/(?:\r\n|\n|\r)+$/, '') + trailing;
}
