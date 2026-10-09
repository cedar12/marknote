import type { Editor } from '@tiptap/core';
import {
  DEFAULT_SHORTCUT_PREFERENCES,
  SHORTCUT_DEFINITIONS,
  normalizeShortcutPreferences,
  shortcutMatchesEvent,
} from './shortcutPreferences';
import { pasteFromClipboard } from './clipboard';

export interface KeyBinding {
  description: string[];
  key: string;
}

type KeyBindingFn = (bind: KeyBinding) => boolean | void;
const clipboardActions = ['edit.copy', 'edit.cut', 'edit.paste'];

function shortcutTarget(event: KeyboardEvent): Element | null {
  return event.target instanceof Element ? event.target : null;
}

function isShortcutRecording(event: KeyboardEvent): boolean {
  return Boolean(shortcutTarget(event)?.closest('[data-shortcut-recording], [data-shortcut-capture]'));
}

function isComposing(event: KeyboardEvent): boolean {
  return event.isComposing || event.keyCode === 229 || event.key === 'Process' || event.key === 'Dead';
}

function consume(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** One live binding table shared by the app menu and the editor. */
export class KeyBindingBuilder {
  private binds: KeyBinding[] = [];
  private fn: KeyBindingFn | null = null;

  constructor(preferences: unknown = DEFAULT_SHORTCUT_PREFERENCES) {
    this.update(preferences);
    this.bind();
  }

  private get platform(): string {
    return (window as unknown as { os?: string }).os || 'windows';
  }

  update(preferences: unknown): void {
    const normalized = normalizeShortcutPreferences(preferences, this.platform);
    this.binds = SHORTCUT_DEFINITIONS.map(definition => ({
      description: [...definition.description],
      key: normalized[definition.id],
    }));
  }

  getKey(description: string): KeyBinding | undefined {
    return this.binds.find(bind => bind.description.join('.') === description);
  }

  on(fn: KeyBindingFn): void {
    this.fn = fn;
  }

  bind(): void {
    document.removeEventListener('keydown', this.handleAppKeyDown, true);
    document.addEventListener('keydown', this.handleAppKeyDown, true);
  }

  unbind(): void {
    document.removeEventListener('keydown', this.handleAppKeyDown, true);
  }

  private findBinding(event: KeyboardEvent): KeyBinding | undefined {
    return this.binds.find(bind => bind.key && shortcutMatchesEvent(bind.key, event, this.platform));
  }

  private handleAppKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isComposing(event) || isShortcutRecording(event) || !this.fn) return;
    if (shortcutTarget(event)?.closest('input, textarea, select, [contenteditable="false"]')) return;
    const bind = this.findBinding(event);
    if (!bind || !(['file', 'view'].includes(bind.description[0]) || bind.description.join('.') === 'edit.find')) return;
    // Consume repeats as well, so holding Save or New never opens multiple dialogs/windows.
    if (event.repeat) {
      consume(event);
      return;
    }
    if (this.fn(bind) === true) consume(event);
  };

  /** Runs before Tiptap extension keymaps, preventing duplicate/default actions after rebinding. */
  handleEditorKeyDown(editor: Editor, event: KeyboardEvent): boolean {
    if (event.defaultPrevented || isComposing(event) || isShortcutRecording(event) || editor.isDestroyed || !editor.isEditable) return false;
    // Editors embed ordinary controls in node views; their editing keys belong to those controls.
    if (shortcutTarget(event)?.closest('input, textarea, select, [contenteditable="false"]')) return false;

    const bind = this.findBinding(event);
    const id = bind?.description.join('.');
    if (bind && id && (['format', 'paragraph'].includes(bind.description[0]) || (bind.description[0] === 'edit' && id !== 'edit.find'))) {
      if (event.repeat) {
        consume(event);
        return true;
      }
      const definition = SHORTCUT_DEFINITIONS.find(item => item.id === id);
      // Keep the native clipboard event pipeline for its conventional keys, including image paste.
      if (clipboardActions.includes(id) && bind.key === definition?.defaultKey) return false;
      consume(event);
      this.executeEditorAction(editor, id);
      return true;
    }

    const defaultBinding = SHORTCUT_DEFINITIONS.find(definition => {
      const category = definition.description[0];
      return (category === 'edit' || category === 'format' || category === 'paragraph')
        && definition.defaultKey
        && shortcutMatchesEvent(definition.defaultKey, event, this.platform)
        && this.getKey(definition.id)?.key !== definition.defaultKey;
    });
    const changedRedoAlias = shortcutMatchesEvent('Mod+Shift+Z', event, this.platform)
      && this.getKey('edit.redo')?.key !== DEFAULT_SHORTCUT_PREFERENCES['edit.redo'];
    if (defaultBinding || changedRedoAlias) {
      consume(event);
      return true;
    }
    return false;
  }

  executeEditorAction(editor: Editor, id: string): void {
    const commands = editor.commands;
    switch (id) {
      case 'edit.undo': commands.undo(); break;
      case 'edit.redo': commands.redo(); break;
      case 'edit.selectAll': commands.selectAll(); break;
      case 'edit.copy': document.execCommand('copy'); break;
      case 'edit.cut': document.execCommand('cut'); break;
      case 'edit.paste': void pasteFromClipboard(editor); break;
      case 'format.bold': commands.toggleBold(); break;
      case 'format.italic': commands.toggleItalic(); break;
      case 'format.strikethrough': commands.toggleStrike(); break;
      case 'format.inlineCode': commands.toggleCode(); break;
      case 'paragraph.normalText': commands.setParagraph(); break;
      case 'paragraph.table': commands.insertTable({ rows: 2, cols: 3, withHeaderRow: true }); break;
      case 'paragraph.codeFences': commands.toggleCodeBlock(); break;
      case 'paragraph.bulletList': commands.toggleBulletList(); break;
      case 'paragraph.orderedList': commands.toggleOrderedList(); break;
      case 'paragraph.taskList': commands.toggleTaskList(); break;
      case 'paragraph.quoteBlock': commands.toggleBlockquote(); break;
      case 'paragraph.paragraph': commands.setHardBreak(); break;
      case 'paragraph.mathBlock': commands.setKatex(); break;
      case 'paragraph.horizontalRule': commands.setHorizontalRule(); break;
      default: {
        const heading = /^paragraph\.heading([1-6])$/.exec(id);
        if (heading) commands.toggleHeading({ level: Number(heading[1]) as 1 | 2 | 3 | 4 | 5 | 6 });
      }
    }
  }
}
