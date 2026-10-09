export interface EditorFontPreferences {
  fontFamily: string;
  fontSize: number;
}

export const EDITOR_FONT_PREFERENCES_KEY = 'editorFontPreferences';
export const DEFAULT_EDITOR_FONT: Readonly<EditorFontPreferences> = { fontFamily: 'system', fontSize: 16 };
export const MIN_EDITOR_FONT_SIZE = 12;
export const MAX_EDITOR_FONT_SIZE = 32;
export const EDITOR_FONT_PRESETS = ['system', 'sans-serif', 'serif', 'monospace'] as const;

export function isValidEditorFontFamily(value: unknown): value is string {
  // Accept a single local font name, rather than a CSS declaration or font stack.
  return typeof value === 'string' && Boolean(value.trim()) && value.trim().length <= 128
    && !/[;,"\\{}<>\p{Cc}]/u.test(value);
}

export function normalizeEditorFont(value: unknown): EditorFontPreferences {
  const source = value && typeof value === 'object' ? value as Partial<EditorFontPreferences> : {};
  return {
    fontFamily: isValidEditorFontFamily(source.fontFamily) ? source.fontFamily.trim() : DEFAULT_EDITOR_FONT.fontFamily,
    fontSize: Number.isInteger(source.fontSize) && source.fontSize! >= MIN_EDITOR_FONT_SIZE && source.fontSize! <= MAX_EDITOR_FONT_SIZE
      ? source.fontSize! : DEFAULT_EDITOR_FONT.fontSize,
  };
}

export function readEditorFont(): EditorFontPreferences {
  try {
    return normalizeEditorFont(JSON.parse(localStorage.getItem(EDITOR_FONT_PREFERENCES_KEY) || 'null'));
  } catch { return { ...DEFAULT_EDITOR_FONT }; }
}

export function editorFontFamilyCSS(fontFamily: string): string {
  const family = normalizeEditorFont({ fontFamily }).fontFamily;
  switch (family) {
    case 'system': return 'var(--fontFamily)';
    case 'sans-serif': return 'Arial, "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
    case 'serif': return 'Georgia, "Songti SC", SimSun, "Noto Serif CJK SC", serif';
    case 'monospace': return 'ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", "Noto Sans Mono CJK SC", monospace';
    default: return `"${family}", var(--fontFamily)`;
  }
}

export function applyEditorFontToDocument(value: EditorFontPreferences) {
  document.documentElement.style.setProperty('--editorFontFamily', editorFontFamilyCSS(value.fontFamily));
  document.documentElement.style.setProperty('--editorFontSize', `${value.fontSize}px`);
}