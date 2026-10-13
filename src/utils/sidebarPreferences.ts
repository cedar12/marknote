export const SIDEBAR_VISIBLE_KEY = 'sidebarVisible';

export function normalizeSidebarVisible(value: unknown, fallback = false): boolean {
  return value === 'true' ? true : value === 'false' ? false : fallback;
}

export function readSidebarVisible(fallback = false, storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    const source = storage ?? globalThis.localStorage;
    return normalizeSidebarVisible(source?.getItem(SIDEBAR_VISIBLE_KEY), fallback);
  } catch { return fallback; }
}

export function writeSidebarVisible(visible: boolean, storage?: Pick<Storage, 'setItem'>): boolean {
  if (typeof visible !== 'boolean') return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(SIDEBAR_VISIBLE_KEY, String(visible));
    return true;
  } catch { return false; }
}
