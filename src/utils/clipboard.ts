import type { Editor } from '@tiptap/core';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { message } from '@tauri-apps/plugin-dialog';
import * as appLog from '@tauri-apps/plugin-log';
import i18n from '../i18n';

interface ClipboardContent {
  html: string;
  text: string;
}

async function readClipboardContent(): Promise<ClipboardContent> {
  try {
    if (typeof navigator.clipboard?.read === 'function') {
      const items = await navigator.clipboard.read();
      let html = '';
      let text = '';
      for (const item of items) {
        let readError: unknown;
        if (!html && item.types.includes('text/html')) {
          try { html = await (await item.getType('text/html')).text(); }
          catch (error) { readError = error; }
        }
        if (!text && item.types.includes('text/plain')) {
          try { text = await (await item.getType('text/plain')).text(); }
          catch (error) { readError = error; }
        }
        if (html || text) return { html, text };
        if (readError) throw readError;
      }
      // Empty text or a clipboard with no supported text content is a normal no-op.
      return { html: '', text: '' };
    }
  } catch { /* The native clipboard remains available if browser access is denied. */ }
  return { html: '', text: (await readText()) || '' };
}

function pasteEvent(content: ClipboardContent): ClipboardEvent {
  let data: DataTransfer;
  if (typeof DataTransfer === 'function') {
    data = new DataTransfer();
    if (content.text) data.setData('text/plain', content.text);
    if (content.html) data.setData('text/html', content.html);
  } else {
    // Older WebKit exposes paste events without a constructible DataTransfer.
    data = {
      items: [],
      types: [content.text && 'text/plain', content.html && 'text/html'].filter(Boolean),
      getData(type: string) { return type.toLowerCase() === 'text/html' ? content.html : content.text; },
    } as unknown as DataTransfer;
  }
  let event: ClipboardEvent;
  try { event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }); }
  catch { event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent; }
  if (event.clipboardData !== data) Object.defineProperty(event, 'clipboardData', { value: data });
  return event;
}

/** Use the same paste pipeline as the keyboard, including the live Markdown preferences. */
export async function pasteFromClipboard(editor: Editor | undefined): Promise<boolean> {
  if (!editor || editor.isDestroyed) return false;
  const view = editor.view;
  const document = view.state.doc;
  const bookmark = view.state.selection.getBookmark();
  view.focus();
  try {
    const content = await readClipboardContent();
    if (!content.html && !content.text) return false;
    // Do not insert into another document if editing or navigation happened during the read.
    if (editor.isDestroyed || view.state.doc !== document) return false;
    const selection = bookmark.resolve(document);
    if (!view.state.selection.eq(selection)) {
      view.dispatch(view.state.tr.setSelection(selection).setMeta('addToHistory', false));
    }
    view.focus();
    const event = pasteEvent(content);
    if (content.html) {
      // Record the paste event for plugins that recognize internal ProseMirror HTML.
      const handled = view.someProp('handleDOMEvents', handlers => {
        const handle = handlers.paste;
        return handle ? handle(view, event) || event.defaultPrevented : false;
      });
      return handled ? true : view.pasteHTML(content.html, event);
    }
    // pasteText sets preferPlain=true and bypasses Markdown; a normal paste event preserves it.
    view.dispatchEvent(event);
    return event.defaultPrevented || view.state.doc !== document;
  } catch (error) {
    const detail = `Clipboard paste failed: ${String(error)}`;
    try { await appLog.error(detail); } catch { console.error(detail); }
    // @ts-ignore
    const { t } = i18n.global;
    try { await message(t('pasteFailed'), { title: t('paste'), kind: 'error' }); }
    catch { /* A clipboard failure must never become an unhandled dialog rejection. */ }
    return false;
  }
}
