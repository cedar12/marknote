export const LARGE_FILE_THRESHOLD = 512 * 1024;
export const SEGMENT_TARGET_SIZE = 128 * 1024;

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

function isFence(line: string): string | null {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return match?.[1] || null;
}

/**
 * Split only at blank Markdown block boundaries outside fenced code blocks.
 * Every character remains in exactly one segment, so an untouched large file
 * can be saved byte-for-byte (after the platform's UTF-8 decode/encode).
 */
export function splitMarkdownIntoSegments(content: string, targetSize = SEGMENT_TARGET_SIZE): string[] {
  if (content.length <= targetSize) return [content];

  const lines = content.match(/.*?(?:\r\n|\n|\r|$)/g)?.filter(Boolean) || [content];
  const segments: string[] = [];
  let current = '';
  let activeFence: string | null = null;

  for (const line of lines) {
    current += line;
    const fence = isFence(line);
    if (fence) {
      if (!activeFence) activeFence = fence;
      else if (fence[0] === activeFence[0] && fence.length >= activeFence.length) activeFence = null;
    }

    const blankBoundary = !activeFence && /^\s*(?:\r\n|\n|\r)$/.test(line);
    if (current.length >= targetSize && blankBoundary) {
      segments.push(current);
      current = '';
    }
  }

  if (current || segments.length === 0) segments.push(current);
  return segments;
}

export function preserveBoundaryNewlines(markdown: string, original: string): string {
  const trailing = original.match(/(?:\r\n|\n|\r)+$/)?.[0] || '';
  if (!trailing) return markdown;
  return markdown.replace(/(?:\r\n|\n|\r)+$/, '') + trailing;
}
