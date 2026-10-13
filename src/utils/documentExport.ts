import type { Editor } from '@tiptap/core';
import editorStyles from '../scss/editor.scss?inline';
import codeStyles from '../scss/codeTheme.scss?inline';
import light from '../theme/style/light';
import { prepareStaticDocument, staticDocumentStyles } from './imageExport';

const standaloneStyles = `
html,body { margin:0; min-height:100%; background:var(--contentBackgroundColor); color:var(--contentTextColor); }
.image-export-document { width:100%; max-width:960px; margin:0 auto; position:static; }
.image-export-document .katex-display { display:block; text-align:center; margin:1em 0; }
.image-export-document math { font-size:1.1em; }
.image-export-document img { max-width:100%; height:auto; }
@page { size:A4; margin:16mm; }
@media print { .image-export-document { padding:0; max-width:none; } pre,blockquote,tr,img,math { break-inside:avoid; } h1,h2,h3,h4,h5,h6 { break-after:avoid; } }
`;

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image encoding failed'));
    reader.onerror = () => reject(reader.error || new Error('Image encoding failed'));
    reader.readAsDataURL(blob);
  });
}

async function embedImage(image: HTMLImageElement): Promise<void> {
  if (image.src.startsWith('data:')) return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(image.src, { signal: controller.signal });
    if (!response.ok) throw new Error('Image resource could not be read');
    const blob = await response.blob();
    if (!blob.size) throw new Error('Image resource is empty');
    image.src = await dataUrl(blob);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Self-contained HTML; renders all segments without touching the live editor. */
export async function renderDocumentHTML(editor: Editor, markdown: string, sourcePath: string | null, options: { print?: boolean; title?: string; locale?: string } = {}): Promise<string> {
  const root = document.createElement('div');
  root.className = 'marknote image-export-document';
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('inert', '');
  root.style.cssText = 'position:absolute;left:-100000px;top:0;width:960px;pointer-events:none;';
  const codeTheme = editor.view.dom.closest('[class*="code-theme-"]')?.className.match(/code-theme-[\w-]+/)?.[0];
  root.classList.add(options.print ? 'code-theme-github' : codeTheme || 'code-theme-nnfx-light');
  const computed = getComputedStyle(document.documentElement);
  for (const key of [...Object.keys(light.style), 'fontFamily', 'editorFontFamily', 'editorFontSize', 'tabSize']) {
    const value = options.print && key in light.style ? light.style[key as keyof typeof light.style] : computed.getPropertyValue('--' + key);
    if (value) root.style.setProperty('--' + key, value);
  }
  const style = document.createElement('style');
  style.textContent = editorStyles + codeStyles + staticDocumentStyles + standaloneStyles;
  try {
    document.head.append(style);
    document.body.append(root);
    await prepareStaticDocument(editor, markdown, root, sourcePath, !!options.print);
    // Native MathML keeps formulas portable without external KaTeX font files.
    root.querySelectorAll('.katex').forEach(katex => {
      const math = katex.querySelector('math');
      if (math) katex.replaceWith(math.cloneNode(true));
    });
    const results = await Promise.allSettled(Array.from(root.querySelectorAll('img'), embedImage));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
    root.querySelectorAll('input').forEach(input => { input.disabled = true; });
    root.removeAttribute('aria-hidden');
    root.removeAttribute('inert');
    root.style.removeProperty('position');
    root.style.removeProperty('left');
    root.style.removeProperty('top');
    root.style.removeProperty('width');
    root.style.removeProperty('pointer-events');
    const output = document.implementation.createHTMLDocument(options.title || 'MarkNote');
    output.documentElement.style.cssText = root.style.cssText;
    output.documentElement.lang = options.locale === 'zhCn' ? 'zh-CN' : 'en';
    const charset = output.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    output.head.prepend(charset);
    const viewport = output.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    output.head.append(viewport, output.importNode(style, true));
    output.body.append(output.importNode(root, true));
    return '<!doctype html>\n' + output.documentElement.outerHTML;
  } finally {
    root.remove();
    style.remove();
  }
}
