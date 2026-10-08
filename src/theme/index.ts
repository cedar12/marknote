import { reactive } from 'vue';
import light from './style/light';
import dark from './style/dark';
import { listThemes, type ThemeEntry } from '../api/theme';
import mermaid from 'mermaid';

export const THEME_STYLE_KEYS = [
  'primaryBackgroundColor', 'primaryBackgroundColorHover', 'primaryBackgroundColorActive',
  'primaryTextColor', 'primaryTextColorHover', 'primaryTextColorActive', 'primaryBorderColor',
  'contentBackgroundColor', 'contentBackgroundColorActive', 'contentBackgroundColorHover',
  'contentTextColor', 'contentTextColorActive', 'contentTextColorHover', 'contentBorderColor',
] as const;

const builtInThemes: ThemeEntry[] = [light, dark].map(theme => ({ ...theme, source: 'bundled', removable: false }));
export const isBuiltInTheme = (value: string) => ['light', 'dark'].includes(value.toLowerCase());

export function isThemeItem(value: unknown): value is ThemeItem {
  if (!value || typeof value !== 'object') return false;
  const theme = value as ThemeItem;
  return typeof theme.label === 'string' && Boolean(theme.label.trim()) && Array.from(theme.label).length <= 128 && !/\p{Cc}/u.test(theme.label)
    && typeof theme.value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(theme.value)
    && (theme.type === 'light' || theme.type === 'dark')
    && Boolean(theme.style) && typeof theme.style === 'object'
    && THEME_STYLE_KEYS.every(key => typeof theme.style[key] === 'string' && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(theme.style[key]));
}

function cachedThemes(): ThemeEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('MarkNoteThemes') || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(isThemeItem).filter(theme => !isBuiltInTheme(theme.value)).map(theme => ({
      ...theme, source: 'bundled' as const, removable: false,
    }));
  } catch { return []; }
}

const themes = reactive<ThemeEntry[]>([...builtInThemes, ...cachedThemes()]);
export default themes;
let catalogRevision = 0;

export function applyThemeCatalog(entries: ThemeEntry[]) {
  if (!Array.isArray(entries)) return;
  catalogRevision += 1;
  const seen = new Set<string>(['light', 'dark']);
  const installed = entries.filter(entry => {
    if (!isThemeItem(entry) || seen.has(entry.value.toLowerCase())) return false;
    seen.add(entry.value.toLowerCase());
    return true;
  }).map(entry => ({ ...entry, removable: entry.source === 'installed' && entry.removable === true }));
  themes.splice(0, themes.length, ...builtInThemes, ...installed);
  localStorage.setItem('MarkNoteThemes', JSON.stringify(installed));
}

export async function refreshThemeCatalog() {
  const revision = catalogRevision;
  const entries = await listThemes();
  if (revision === catalogRevision) applyThemeCatalog(entries);
  return themes.filter(theme => !isBuiltInTheme(theme.value));
}

export async function getThemes() { return refreshThemeCatalog(); }

export function findThemeByType(type: ThemeType) {
  return themes.find(theme => theme.type === type);
}

export function setTheme(value: ThemeItem) {
  if (!isThemeItem(value)) return;
  localStorage.setItem('theme', JSON.stringify(value));
  for (const key of THEME_STYLE_KEYS) document.documentElement.style.setProperty(`--${key}`, value.style[key]);
  mermaid.initialize({ theme: value.type === 'light' ? 'default' : 'dark' });
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(value.type);
}

export type ThemeType = 'light' | 'dark';
export interface ThemeItem {
  label: string;
  value: string;
  type: ThemeType;
  style: ThemeStyle;
}
export interface ThemeStyle {
  primaryBackgroundColor: string;
  primaryBackgroundColorHover: string;
  primaryBackgroundColorActive: string;
  primaryTextColor: string;
  primaryTextColorHover: string;
  primaryTextColorActive: string;
  primaryBorderColor: string;
  contentBackgroundColor: string;
  contentBackgroundColorActive: string;
  contentBackgroundColorHover: string;
  contentTextColor: string;
  contentTextColorActive: string;
  contentTextColorHover: string;
  contentBorderColor: string;
}
