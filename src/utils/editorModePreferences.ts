import type { SourceMode } from './sourceDocument';

export const EDITOR_MODE_PREFERENCES_KEY = 'editorModePreferences';
export const EDITOR_MODE_PREFERENCES_EVENT = 'editorModePreferences';

export function isSourceMode(value: unknown): value is SourceMode {
  return value === 'wysiwyg' || value === 'source' || value === 'split';
}

export function readEditorMode(): SourceMode {
  try {
    const value = localStorage.getItem(EDITOR_MODE_PREFERENCES_KEY);
    return isSourceMode(value) ? value : 'wysiwyg';
  } catch { return 'wysiwyg'; }
}
