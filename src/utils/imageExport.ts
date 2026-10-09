import type { Editor } from '@tiptap/core';
import { convertFileSrc, isTauri } from '@tauri-apps/api/core';
import html2canvas from 'html2canvas';
import mermaid from 'mermaid';
import katexStyles from 'katex/dist/katex.min.css?inline';
import light from '../theme/style/light';
import { lowlight } from './lowlight';
import type { ImageExportOptions } from './imageExportOptions';

export type ImageExportErrorCode = 'imageExportTooLarge' | 'imageExportImageFailed' | 'imageExportRenderFailed';

export class ImageExportError extends Error {
  constructor(public readonly code: ImageExportErrorCode, details: string) {
    super(details);
    this.name = 'ImageExportError';
  }
}

const MAX_PIXELS = 32 * 1024 * 1024;
const MAX_SIDE = 32767;
const RESOURCE_TIMEOUT = 15000;
let nextCaptureId = 0;

// KaTeX's stylesheet consists of font faces and flat style rules. Prefix its
// selectors so an export cannot change the editor's layout while fonts load.
const scopedKatexStyles = katexStyles.replace(/(^|})([^{}@]+)\{/g, (_match, boundary, selectors) =>
  `${boundary}${selectors.split(',').map((selector: string) => `.image-export-document ${selector.trim()}`).join(',')}{`);

const exportStyles = `
.image-export-document { box-sizing:border-box; min-height:0; overflow:visible; overflow-wrap:anywhere; padding:32px; }
.image-export-document > h1::before,.image-export-document > h2::before,.image-export-document > h3::before,
.image-export-document > h4::before,.image-export-document > h5::before,.image-export-document > h6::before { display:none; }
.image-export-document pre { padding:14px 1em; white-space:pre-wrap; overflow-wrap:anywhere; tab-size:var(--tabSize,4); }
.image-export-document pre code { display:block; white-space:inherit; }
.image-export-document .image-export-diagram { display:block; margin:1em auto; max-width:100%; height:auto; }
.image-export-document .katex-mathml { display:none; }
.image-export-document .katex-display { overflow:visible; }
.image-export-document * { animation:none!important; transition:none!important; caret-color:transparent!important; }
`;

function resourcePath(source: string, sourcePath: string | null): string {
  if (/^(?:data:|blob:|https?:|asset:|tauri:)/i.test(source)) return source;
  if (/^\/\//.test(source)) return new URL(source, window.location.href).href;
  if (!isTauri()) return new URL(source, window.location.href).href;
  // markdown-it URL-encodes local image paths; convertFileSrc expects the
  // original filesystem path, including spaces and non-ASCII characters.
  let fileSource = source;
  try { fileSource = decodeURIComponent(source); } catch { /* A literal % is a valid filename character. */ }
  if (/^(?:[a-z]:[\\/]|\/)/i.test(fileSource)) return convertFileSrc(fileSource);
  if (!sourcePath) throw new ImageExportError('imageExportImageFailed', `Relative image has no document path: ${source}`);
  const directory = sourcePath.slice(0, Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\')) + 1);
  return convertFileSrc(directory + fileSource);
}

async function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read image'));
    reader.onerror = () => reject(reader.error || new Error('Unable to read image'));
    reader.readAsDataURL(blob);
  });
}

async function loadImage(image: HTMLImageElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      error ? reject(error) : resolve();
    };
    const loaded = () => {
      if (image.naturalWidth <= 0) { failed(); return; }
      if (typeof image.decode === 'function') image.decode().then(() => finish(), failed);
      else finish();
    };
    const failed = () => finish(new ImageExportError('imageExportImageFailed', 'Image could not be decoded'));
    const timeout = window.setTimeout(() => finish(new ImageExportError('imageExportImageFailed', 'Image loading timed out')), RESOURCE_TIMEOUT);
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    if (image.complete) image.naturalWidth > 0 ? loaded() : failed();
  });
}

async function prepareImages(root: HTMLElement, sourcePath: string | null): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < images.length) {
      const image = images[nextIndex++];
      const source = image.getAttribute('src') || '';
      try {
        if (!source) throw new Error('Image source is empty');
        const resolved = resourcePath(source, sourcePath);
        image.removeAttribute('srcset');
        image.removeAttribute('sizes');
        image.loading = 'eager';
        image.crossOrigin = 'anonymous';
        image.src = resolved;
        await loadImage(image);
      } catch (error) {
        throw new ImageExportError('imageExportImageFailed', `Unable to export image ${source}: ${String(error)}`);
      }
    }
  };
  // Wait for every worker to settle before removing the temporary document.
  const results = await Promise.allSettled(Array.from({ length: Math.min(4, images.length) }, worker));
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) throw failed.reason;
}

function highlightCode(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('pre > code').forEach(code => {
    const language = Array.from(code.classList).find(value => value.startsWith('language-'))?.slice(9);
    if (language === 'mermaid') return;
    code.parentElement?.classList.add('hljs');
    // Auto detection tests every registered language. Keep unlabelled/unknown
    // fences plain so large documents do not pay that cost during export.
    if (!language || !lowlight.listLanguages().includes(language)) return;
    const highlighted = lowlight.highlight(language, code.textContent || '');
    const append = (nodes: any[], target: Node) => {
      for (const node of nodes) {
        if (node.type === 'text') target.appendChild(document.createTextNode(node.value));
        else {
          const span = document.createElement('span');
          span.className = (node.properties?.className || []).join(' ');
          append(node.children || [], span);
          target.appendChild(span);
        }
      }
    };
    code.replaceChildren();
    append(highlighted.children, code);
  });
  root.querySelectorAll<HTMLElement>('code').forEach(code => {
    if (!code.closest('pre')) code.classList.add('inline');
  });
}

function restoreTaskItems(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('li[data-type="taskItem"]').forEach(item => {
    const body = document.createElement('div');
    body.append(...Array.from(item.childNodes));
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = item.dataset.checked === 'true';
    if (input.checked) input.setAttribute('checked', '');
    label.append(input, document.createElement('span'));
    item.append(label, body);
  });
}

async function renderDiagrams(root: HTMLElement, whiteBackground: boolean) {
  const codes = Array.from(root.querySelectorAll<HTMLElement>('pre > code.language-mermaid'));
  if (!codes.length) return;
  const previousConfig = JSON.parse(JSON.stringify(mermaid.mermaidAPI.getSiteConfig()));
  mermaid.initialize({ ...previousConfig, startOnLoad: false,
    theme: whiteBackground ? 'default' : previousConfig.theme,
    flowchart: { ...previousConfig.flowchart, htmlLabels: false },
  });
  const renderingHost = document.createElement('div');
  root.append(renderingHost);
  try {
    for (const code of codes) {
      const { svg } = await mermaid.render(`image-export-mermaid-${Date.now()}-${nextCaptureId++}`, code.textContent || '', renderingHost);
      const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const svgRoot = svgDocument.documentElement;
      const viewBox = svgRoot.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
      if (viewBox?.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
        svgRoot.setAttribute('width', String(viewBox[2]));
        svgRoot.setAttribute('height', String(viewBox[3]));
      }
      const image = document.createElement('img');
      image.className = 'image-export-diagram';
      image.alt = 'Mermaid diagram';
      image.src = await readBlob(new Blob([new XMLSerializer().serializeToString(svgRoot)], { type: 'image/svg+xml;charset=utf-8' }));
      code.parentElement?.replaceWith(image);
    }
  } finally {
    renderingHost.remove();
    mermaid.initialize(previousConfig);
  }
}

async function fontsReady() {
  if (!document.fonts) return;
  let timer: number | undefined;
  try {
    await Promise.race([document.fonts.ready, new Promise<never>((_resolve, reject) => {
      timer = window.setTimeout(() => reject(new ImageExportError('imageExportRenderFailed', 'Font loading timed out')), RESOURCE_TIMEOUT);
    })]);
  } finally {
    window.clearTimeout(timer);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, options: ImageExportOptions): Promise<Blob> {
  const mime = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob || blob.type !== mime || blob.size === 0) reject(new ImageExportError('imageExportRenderFailed', 'Canvas encoding failed'));
    else resolve(blob);
  }, mime, options.quality));
}

/** Render a complete Markdown snapshot without changing editor state or scroll. */
export async function renderDocumentImage(editor: Editor, markdown: string, options: ImageExportOptions, sourcePath: string | null = null): Promise<Blob> {
  const captureId = `image-export-${Date.now()}-${nextCaptureId++}`;
  const root = document.createElement('div');
  root.className = 'marknote image-export-document';
  root.dataset.imageExportId = captureId;
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('inert', '');
  root.style.cssText = `position:absolute;left:-100000px;top:0;width:${options.width}px;min-height:0;pointer-events:none;`;
  const white = options.background === 'white';
  const themeClass = editor.view.dom.closest('[class*="code-theme-"]')?.className.match(/code-theme-[\w-]+/)?.[0];
  root.classList.add(white ? 'code-theme-github' : themeClass || 'code-theme-nnfx-light');
  if (white) {
    Object.entries(light.style).forEach(([key, value]) => root.style.setProperty(`--${key}`, value));
  }
  if (options.background === 'transparent') root.style.backgroundColor = 'transparent';
  const style = document.createElement('style');
  style.textContent = scopedKatexStyles + exportStyles;
  let canvas: HTMLCanvasElement | undefined;
  try {
    const parsed = new DOMParser().parseFromString(editor.storage.markdown.parser.parse(markdown), 'text/html').body;
    // Exported HTML is inert; do not run document-provided scripts or handlers.
    parsed.querySelectorAll('script,iframe,object,embed,style,link,base,meta').forEach(element => element.remove());
    parsed.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        if (attribute.name.startsWith('on') || attribute.name === 'autofocus') element.removeAttribute(attribute.name);
      });
    });
    root.replaceChildren(...Array.from(parsed.childNodes));
    restoreTaskItems(root);
    highlightCode(root);
    document.head.append(style);
    document.body.append(root);
    await renderDiagrams(root, white);
    await prepareImages(root, sourcePath);
    // Ensure layout has requested the KaTeX/font-family resources before waiting.
    root.getBoundingClientRect();
    await fontsReady();
    const width = Math.ceil(root.getBoundingClientRect().width);
    const height = Math.max(1, Math.ceil(root.getBoundingClientRect().height));
    const pixelWidth = width * options.scale;
    const pixelHeight = height * options.scale;
    if (!Number.isFinite(pixelWidth * pixelHeight) || pixelWidth < 1 || pixelHeight < 1
      || pixelWidth > MAX_SIDE || pixelHeight > MAX_SIDE || pixelWidth * pixelHeight > MAX_PIXELS) {
      throw new ImageExportError('imageExportTooLarge', `Export dimensions ${pixelWidth} × ${pixelHeight} exceed the image limit`);
    }
    const backgroundColor = options.background === 'transparent' ? null : getComputedStyle(root).backgroundColor;
    canvas = await html2canvas(root, {
      scale: options.scale, width, height, backgroundColor,
      useCORS: true, allowTaint: false, imageTimeout: RESOURCE_TIMEOUT,
      logging: false, scrollX: 0, scrollY: 0, windowWidth: Math.max(window.innerWidth, width),
      removeContainer: true,
      onclone(_document, clonedRoot) {
        clonedRoot.style.left = '0';
        clonedRoot.style.top = '0';
      },
    });
    return await canvasBlob(canvas, options);
  } catch (error) {
    if (error instanceof ImageExportError) throw error;
    throw new ImageExportError('imageExportRenderFailed', String(error));
  } finally {
    root.remove();
    style.remove();
    // html2canvas removes its iframe on success only. Remove our clone on errors.
    document.querySelectorAll<HTMLIFrameElement>('iframe.html2canvas-container').forEach(frame => {
      if (frame.contentDocument?.querySelector(`[data-image-export-id="${captureId}"]`)) frame.remove();
    });
    if (canvas) { canvas.width = 0; canvas.height = 0; }
  }
}
