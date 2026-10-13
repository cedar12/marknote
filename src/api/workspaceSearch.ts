import { invoke, isTauri } from '@tauri-apps/api/core';
import type { SourceSearchMatch } from '../utils/documentSearch';
import type { FileVersion } from '../utils/fileVersion';
export interface WorkspaceSearchMatch extends SourceSearchMatch {
  path: string; relativePath: string; version: FileVersion;
}
export interface WorkspaceSearchPage {
  searchId: string; root: string; results: WorkspaceSearchMatch[];
  scannedFiles: number; scannedEntries: number; skippedFiles: number;
  skipReasons: { large: number; unreadable: number; links: number; depth: number; changed: number };
  done: boolean; cancelled: boolean; truncated: boolean;
}
export function startWorkspaceSearch(searchId: string, root: string, query: string, caseSensitive: boolean) {
  if (!isTauri()) return Promise.reject(new Error('searchWorkspaceNativeOnly'));
  return invoke<WorkspaceSearchPage>('workspace_search_start', { searchId, root, query, caseSensitive });
}
export function nextWorkspaceSearch(searchId: string) { return invoke<WorkspaceSearchPage>('workspace_search_next', { searchId }); }
export function cancelWorkspaceSearch(searchId: string) {
  if (!isTauri()) return Promise.resolve();
  return invoke<void>('workspace_search_cancel', { searchId });
}
