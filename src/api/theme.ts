import { invoke } from '@tauri-apps/api/core';
import type { ThemeItem } from '../theme';

export interface ThemeEntry extends ThemeItem {
  source: 'installed' | 'bundled';
  removable: boolean;
}

export type ThemeErrorCode =
  | 'invalid_theme'
  | 'duplicate_theme'
  | 'builtin_theme'
  | 'theme_not_found'
  | 'io_error'
  | 'path_error';

export interface ThemeError {
  code: ThemeErrorCode;
  message: string;
}

/** Built-in Light and Dark are added by the frontend catalog. */
export function listThemes(): Promise<ThemeEntry[]> {
  return invoke('theme_list');
}

/** Copies a validated JSON file into the per-user application theme directory. */
export function installTheme(path: string): Promise<ThemeItem> {
  return invoke('theme_install', { path });
}

/** Only installed themes can be removed; source paths are never accepted. */
export function uninstallTheme(value: string): Promise<void> {
  return invoke('theme_uninstall', { value });
}
