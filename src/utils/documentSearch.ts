export const SEARCH_RESULT_LIMIT = 300;
export const SEARCH_REPLACE_LIMIT = 10000;
export const SEARCH_QUERY_LIMIT = 256;
export interface SourceSearchMatch {
  from: number; to: number; line: number; column: number;
  before: string; matched: string; after: string;
}
export interface SearchScan { results: SourceSearchMatch[]; truncated: boolean; cancelled: boolean }
export function literalPattern(query: string, matchCase: boolean): RegExp {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'gu' : 'giu');
}
function tail(value: string, count: number) { return Array.from(value).slice(-count).join(''); }
function head(value: string, count: number) { return Array.from(value).slice(0, count).join(''); }
export function sourceSnippet(text: string, from: number, to: number) {
  return { before: tail(text.slice(Math.max(0, from - 100), from), 45), matched: head(text.slice(from, to), 120), after: head(text.slice(to, to + 100), 45) };
}
// Overlapping bounded chunks keep literal matches crossing chunk/segment boundaries,
// while yielding to input, cancellation and composition between scans.
export async function scanDocument(text: string, query: string, matchCase: boolean, options: {
  limit?: number; cancelled?: () => boolean; progress?: (offset: number) => void;
} = {}): Promise<SearchScan> {
  const results: SourceSearchMatch[] = [], limit = options.limit ?? SEARCH_RESULT_LIMIT;
  if (!query) return { results, truncated: false, cancelled: false };
  if (query.length > SEARCH_QUERY_LIMIT) throw new Error('searchQueryTooLong');
  const pattern = literalPattern(query, matchCase);
  let coordinateOffset = 0, line = 1, lineStart = 0, consumed = 0;
  for (let offset = 0; offset < text.length; offset += 32768) {
    if (options.cancelled?.()) return { results: [], truncated: false, cancelled: true };
    const end = Math.min(text.length, offset + 32768);
    const chunk = text.slice(offset, Math.min(text.length, end + query.length + 2));
    pattern.lastIndex = Math.max(0, consumed - offset);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(chunk))) {
      const from = offset + match.index, to = from + match[0].length;
      if (from >= end) break;
      if (results.length === limit) return { results, truncated: true, cancelled: false };
      for (; coordinateOffset < from; coordinateOffset++) if (text.charCodeAt(coordinateOffset) === 10) { line++; lineStart = coordinateOffset + 1; }
      results.push({ from, to, line, column: from - lineStart + 1, ...sourceSnippet(text, from, to) });
      consumed = to;
    }
    // Keep the position cursor caught up on empty chunks as well; otherwise a
    // first hit near the end would count the whole document in one UI turn.
    for (; coordinateOffset < end; coordinateOffset++) if (text.charCodeAt(coordinateOffset) === 10) { line++; lineStart = coordinateOffset + 1; }
    options.progress?.(end);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return { results, truncated: false, cancelled: Boolean(options.cancelled?.()) };
}
export function replaceSourceMatches(text: string, matches: Pick<SourceSearchMatch, 'from' | 'to'>[], replacement: string): string {
  let result = '', cursor = 0;
  for (const match of matches) {
    if (!Number.isInteger(match.from) || !Number.isInteger(match.to) || match.from < cursor || match.to <= match.from || match.to > text.length) throw new Error('invalid_source_ranges');
    result += text.slice(cursor, match.from) + replacement;
    cursor = match.to;
  }
  return result + text.slice(cursor);
}
