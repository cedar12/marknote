export interface ShortcutDefinition {
  id: string;
  description: string[];
  defaultKey: string;
}

export type ShortcutPreferences = Record<string, string>;
export interface ShortcutValidationError {
  type: 'invalid' | 'conflict';
  conflictWith?: string;
}

export const SHORTCUT_PREFERENCES_KEY = 'shortcut_preferences';
export const SHORTCUT_PREFERENCES_EVENT = 'shortcutPreferences';

const commands: [string, string][] = [
  ['file.newWindow', 'Mod+Shift+N'], ['file.newFile', 'Mod+N'],
  ['file.openFile', 'Mod+O'], ['file.save', 'Mod+S'], ['file.saveAs', 'Mod+Shift+S'],
  ['file.preferences', 'Mod+.'], ['file.closeWindow', 'Mod+W'], ['file.quit', 'Mod+Q'],
  ['edit.cut', 'Mod+X'], ['edit.copy', 'Mod+C'], ['edit.paste', 'Mod+V'],
  ['edit.undo', 'Mod+Z'], ['edit.redo', 'Mod+Y'], ['edit.selectAll', 'Mod+A'], ['edit.find', 'Mod+F'],
  ['format.bold', 'Mod+B'], ['format.italic', 'Mod+I'], ['format.strikethrough', 'Mod+Shift+X'],
  ['format.inlineCode', 'Mod+E'],
  ['paragraph.normalText', 'Mod+Alt+0'], ['paragraph.heading1', 'Mod+Alt+1'],
  ['paragraph.heading2', 'Mod+Alt+2'], ['paragraph.heading3', 'Mod+Alt+3'],
  ['paragraph.heading4', 'Mod+Alt+4'], ['paragraph.heading5', 'Mod+Alt+5'], ['paragraph.heading6', 'Mod+Alt+6'],
  ['paragraph.table', 'Mod+Shift+T'], ['paragraph.codeFences', 'Mod+Alt+C'],
  ['paragraph.bulletList', 'Mod+Shift+8'], ['paragraph.orderedList', 'Mod+Shift+7'],
  ['paragraph.taskList', 'Mod+Shift+9'], ['paragraph.quoteBlock', 'Mod+Shift+B'],
  ['paragraph.mathBlock', ''], ['paragraph.paragraph', 'Mod+Enter'], ['paragraph.horizontalRule', ''],
  ['view.sidebar', 'Mod+Shift+E'],
];

export const SHORTCUT_DEFINITIONS: readonly ShortcutDefinition[] = commands.map(([id, defaultKey]) => ({
  id, description: id.split('.'), defaultKey,
}));
export const DEFAULT_SHORTCUT_PREFERENCES: Readonly<ShortcutPreferences> = Object.freeze(
  Object.fromEntries(commands),
);

const modifiers = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'] as const;
const namedKeys: Record<string, string> = {
  enter: 'Enter', return: 'Enter', tab: 'Tab', space: 'Space', spacebar: 'Space',
  escape: 'Escape', esc: 'Escape', backspace: 'Backspace', delete: 'Delete', del: 'Delete',
  insert: 'Insert', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  arrowup: 'ArrowUp', up: 'ArrowUp', arrowdown: 'ArrowDown', down: 'ArrowDown',
  arrowleft: 'ArrowLeft', left: 'ArrowLeft', arrowright: 'ArrowRight', right: 'ArrowRight',
  plus: 'Plus', '+': 'Plus', equal: '=', minus: '-', comma: ',', period: '.', slash: '/',
  semicolon: ';', quote: "'", bracketleft: '[', bracketright: ']', backslash: '\\', backquote: '`',
};

export function shortcutPlatform(): string {
  return typeof window !== 'undefined' && typeof (window as Window & { os?: string }).os === 'string'
    ? (window as Window & { os?: string }).os! : 'windows';
}

function normalizedMainKey(value: string): string | null {
  if (/^[a-z0-9]$/i.test(value)) return value.toUpperCase();
  if (/^f([1-9]|1[0-2])$/i.test(value)) return value.toUpperCase();
  if (/^[=\-,./;'\[\]\\`]$/.test(value)) return value;
  return namedKeys[value.toLowerCase()] || null;
}

/** Use Mod for the platform's primary modifier so recorded bindings remain portable. */
export function normalizeShortcut(value: unknown, platform = shortcutPlatform()): string | null {
  if (typeof value !== 'string' || value.length > 80) return null;
  if (!value.trim()) return '';
  const parts = value.trim().split('+').map(part => part.trim());
  // A literal plus key can be entered as Mod+Plus or Mod++.
  if (parts[parts.length - 1] === '' && parts[parts.length - 2] === '') parts.splice(-2, 2, 'Plus');
  if (parts.some(part => !part)) return null;
  let mainKey = normalizedMainKey(parts.pop()!);
  if (!mainKey) return null;
  const selected = new Set<string>();
  for (const part of parts) {
    const name = part.toLowerCase();
    const modifier = name === 'mod' || name === 'commandorcontrol' ? 'Mod'
      : name === 'ctrl' || name === 'control' ? (platform === 'macos' ? 'Ctrl' : 'Mod')
      : ['cmd', 'command', 'meta', 'win', 'super'].includes(name) ? (platform === 'macos' ? 'Mod' : 'Meta')
      : name === 'alt' || name === 'option' ? 'Alt'
      : name === 'shift' ? 'Shift' : null;
    if (!modifier || selected.has(modifier)) return null;
    selected.add(modifier);
  }
  if (mainKey === 'Plus') {
    mainKey = '=';
    selected.add('Shift');
  }
  // Bare typing keys and Shift alone must remain available for editing text.
  if (![...selected].some(modifier => modifier !== 'Shift') && !/^F\d+$/.test(mainKey)) return null;
  return [...modifiers.filter(modifier => selected.has(modifier)), mainKey].join('+');
}

function resolvedShortcut(value: string, platform: string): string {
  return value.replace(/\bMod\b/g, platform === 'macos' ? 'Meta' : 'Ctrl');
}

export function validateShortcutPreferences(value: unknown, platform = shortcutPlatform()): Record<string, ShortcutValidationError> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const errors: Record<string, ShortcutValidationError> = {};
  const used = new Map<string, string>();
  for (const definition of SHORTCUT_DEFINITIONS) {
    const normalized = normalizeShortcut(source[definition.id], platform);
    if (normalized === null) {
      errors[definition.id] = { type: 'invalid' };
      continue;
    }
    if (!normalized) continue;
    const key = resolvedShortcut(normalized, platform);
    const duplicate = used.get(key);
    if (duplicate) {
      errors[definition.id] = { type: 'conflict', conflictWith: duplicate };
      errors[duplicate] = { type: 'conflict', conflictWith: definition.id };
    } else used.set(key, definition.id);
  }
  return errors;
}

export function normalizeShortcutPreferences(value: unknown, platform = shortcutPlatform()): ShortcutPreferences {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const next: ShortcutPreferences = {};
  for (const definition of SHORTCUT_DEFINITIONS) {
    next[definition.id] = normalizeShortcut(source[definition.id], platform) ?? definition.defaultKey;
  }
  // Never install ambiguous bindings from a damaged or older configuration.
  return Object.keys(validateShortcutPreferences(next, platform)).length ? { ...DEFAULT_SHORTCUT_PREFERENCES } : next;
}

export function readShortcutPreferences(platform = shortcutPlatform()): ShortcutPreferences {
  try {
    return normalizeShortcutPreferences(JSON.parse(localStorage.getItem(SHORTCUT_PREFERENCES_KEY) || 'null'), platform);
  } catch { return { ...DEFAULT_SHORTCUT_PREFERENCES }; }
}

export type ShortcutKeyboardEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>
  & { isComposing?: boolean; getModifierState?: KeyboardEvent['getModifierState'] };

const codeKeys: Record<string, string> = {
  Equal: '=', Minus: '-', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`', Space: 'Space',
};

export function shortcutFromKeyboardEvent(event: ShortcutKeyboardEvent, platform = shortcutPlatform()): string | null {
  if (event.isComposing || event.getModifierState?.('AltGraph') || ['Process', 'Dead', 'Unidentified'].includes(event.key)) return null;
  let mainKey: string | null;
  if (/^Key[A-Z]$/.test(event.code)) mainKey = event.code.substring(3);
  else if (/^Digit\d$/.test(event.code)) mainKey = event.code.substring(5);
  else mainKey = codeKeys[event.code] || normalizedMainKey(event.key === ' ' ? 'Space' : event.key);
  if (!mainKey) return null;
  const selected: string[] = [];
  if (platform === 'macos') {
    if (event.metaKey) selected.push('Mod');
    if (event.ctrlKey) selected.push('Ctrl');
  } else {
    if (event.ctrlKey) selected.push('Mod');
    if (event.metaKey) selected.push('Meta');
  }
  if (event.altKey) selected.push('Alt');
  if (event.shiftKey) selected.push('Shift');
  return normalizeShortcut([...selected, mainKey].join('+'), platform);
}

export function shortcutMatchesEvent(shortcut: string, event: ShortcutKeyboardEvent, platform = shortcutPlatform()): boolean {
  const expected = normalizeShortcut(shortcut, platform);
  const pressed = shortcutFromKeyboardEvent(event, platform);
  return Boolean(expected && pressed && resolvedShortcut(expected, platform) === resolvedShortcut(pressed, platform));
}
