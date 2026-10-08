export interface OutlineHeading {
  level: number;
  text: string;
  id: string;
  segmentIndex: number;
  headingIndex: number;
}

export interface Heading extends OutlineHeading {
  status: 'open' | 'close';
  show: boolean;
}

interface MarkdownToken {
  type: string;
  tag: string;
  content: string;
  children?: MarkdownToken[] | null;
}

export interface OutlineMarkdownParser {
  options: Record<string, unknown>;
  parse(content: string, env: Record<string, unknown>): MarkdownToken[];
  renderer: {
    render(tokens: MarkdownToken[], options: Record<string, unknown>, env: Record<string, unknown>): string;
  };
}

export function headingId(segmentIndex: number, headingIndex: number): string {
  return `heading-${segmentIndex}-${headingIndex}`;
}

/** Tokenize the segment, but create DOM only for its heading fragments. */
export function collectMarkdownHeadings(
  content: string,
  segmentIndex: number,
  parser: OutlineMarkdownParser,
  readHeadings: (html: string) => { level: number; text: string }[],
): OutlineHeading[] {
  const env = {};
  const tokens = parser.parse(content, env);
  const fragments: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'heading_open') {
      let end = index + 1;
      while (end < tokens.length && tokens[end].type !== 'heading_close') end += 1;
      if (end < tokens.length) {
        fragments.push(parser.renderer.render(tokens.slice(index, end + 1), parser.options, env));
        index = end;
      }
    } else if (token.type === 'html_block' && /<h[1-6](?:\s|>)/i.test(token.content)) {
      fragments.push(token.content);
    } else if (token.type === 'inline' && token.children?.some(child => child.type === 'html_inline' && /<\/?h[1-6](?:\s|>)/i.test(child.content))) {
      fragments.push(parser.renderer.render([token], parser.options, env));
    }
  }
  if (fragments.length === 0) return [];
  return readHeadings(fragments.join('\n')).map((heading, headingIndex) => ({
    ...heading,
    id: headingId(segmentIndex, headingIndex),
    segmentIndex,
    headingIndex,
  }));
}

export function mergeOutlineHeadings(segments: OutlineHeading[][], previous: Heading[]): Heading[] {
  const statuses = new Map(previous.map(heading => [heading.id, heading.status]));
  const ancestors: Heading[] = [];
  const headings: Heading[] = [];
  for (const segment of segments) {
    for (const item of segment) {
      while (ancestors.length && ancestors[ancestors.length - 1].level >= item.level) ancestors.pop();
      const heading: Heading = {
        ...item,
        status: statuses.get(item.id) || 'open',
        show: ancestors.every(ancestor => ancestor.status === 'open'),
      };
      ancestors.push(heading);
      headings.push(heading);
    }
  }
  return headings;
}
