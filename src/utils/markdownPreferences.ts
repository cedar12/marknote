export type BulletListMarker = '-' | '*' | '+';

export interface MarkdownPreferences {
  html: boolean;
  breaks: boolean;
  linkify: boolean;
  typographer: boolean;
  tightLists: boolean;
  bulletListMarker: BulletListMarker;
  transformPastedText: boolean;
  transformCopiedText: boolean;
}

export const MARKDOWN_PREFERENCES_KEY = 'markdown_preferences';

export const DEFAULT_MARKDOWN_PREFERENCES: Readonly<MarkdownPreferences> = Object.freeze({
  html: true,
  breaks: true,
  linkify: false,
  typographer: false,
  tightLists: true,
  bulletListMarker: '-',
  transformPastedText: false,
  transformCopiedText: false,
});

/** Ignore invalid or unknown persisted fields while retaining forward-compatible defaults. */
export function normalizeMarkdownPreferences(value: unknown): MarkdownPreferences {
  const result = { ...DEFAULT_MARKDOWN_PREFERENCES };
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  for (const key of ['html', 'breaks', 'linkify', 'typographer', 'tightLists', 'transformPastedText', 'transformCopiedText'] as const) {
    const option = source[key];
    if (typeof option === 'boolean') result[key] = option;
  }
  if (source.bulletListMarker === '-' || source.bulletListMarker === '*' || source.bulletListMarker === '+') {
    result.bulletListMarker = source.bulletListMarker;
  }
  return result;
}

/** Update future parsing and serialization without touching document, selection or history. */
export function applyMarkdownPreferencesToEditor(editor: any, value: MarkdownPreferences): void {
  const storage = editor?.storage?.markdown;
  if (!storage) return;
  const options = normalizeMarkdownPreferences(value);
  Object.assign(storage.options, options, { preserveExistingHtml: true });
  storage.parser.md.set({
    html: options.html,
    breaks: options.breaks,
    linkify: options.linkify,
    typographer: options.typographer,
  });
}
