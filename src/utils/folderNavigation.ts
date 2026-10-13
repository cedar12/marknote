export interface FolderEntry {
  name: string;
  dir: boolean;
  file: boolean;
  path: string;
  children: FolderEntry[];
}

export function folderLabel(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
}

export function folderEntryMatches(entry: Pick<FolderEntry, 'name'>, query: string): boolean {
  return entry.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function normalizeFolderEntries(value: unknown, locale: string): FolderEntry[] {
  if (!Array.isArray(value)) throw new Error('invalid_folder_entries');
  const entries = value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('invalid_folder_entry');
    const entry = item as Record<string, unknown>;
    if (typeof entry.path !== 'string' || !entry.path || typeof entry.name !== 'string' || typeof entry.dir !== 'boolean') {
      throw new Error('invalid_folder_entry');
    }
    return { name: entry.name || folderLabel(entry.path), path: entry.path,
      dir: entry.dir, file: !entry.dir, children: [] };
  });
  const collator = new Intl.Collator(locale === 'zhCn' ? 'zh-CN' : 'en', { numeric: true, sensitivity: 'base' });
  return entries.sort((a, b) => Number(b.dir) - Number(a.dir)
    || collator.compare(a.name, b.name) || a.path.localeCompare(b.path));
}

export const DEFAULT_SIDEBAR_WIDTH = 220;
export const SIDEBAR_WIDTH_KEY = 'sidebarWidth';
export const SIDEBAR_RESIZE_WIDTH = 6;

export function sidebarWidthBounds(viewportWidth: number, preferredMin = DEFAULT_SIDEBAR_WIDTH, maximum = viewportWidth - 90 - SIDEBAR_RESIZE_WIDTH) {
  const available = viewportWidth - 90 - SIDEBAR_RESIZE_WIDTH;
  const max = Math.max(40, Math.min(Math.max(40, available), Number.isFinite(maximum) ? maximum : available));
  return { min: Math.min(preferredMin, max), max };
}

export function normalizeSidebarWidth(value: unknown, fallback = DEFAULT_SIDEBAR_WIDTH): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 40 && parsed <= 10000 ? Math.round(parsed) : fallback;
}

export function clampSidebarWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
