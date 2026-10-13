import { convertFileSrc, isTauri } from '@tauri-apps/api/core';

/** One path policy for live images and self-contained document exports. */
export function resolveDocumentResource(source: string, sourcePath: string | null, mapping: Record<string, string> = {}): string {
  let decoded = source;
  try { decoded = decodeURIComponent(source); } catch { /* Literal percent signs are valid in filenames. */ }
  source = Object.prototype.hasOwnProperty.call(mapping,source) ? mapping[source]
    : Object.prototype.hasOwnProperty.call(mapping,decoded) ? mapping[decoded] : source;
  if (/^(?:data:|blob:|https?:|asset:|tauri:)/i.test(source)) return source;
  if (/^\\\\/.test(source) && isTauri()) return convertFileSrc(source);
  if (/^\/\//.test(source)) return new URL(source, window.location.href).href;
  if (!isTauri()) return new URL(source, window.location.href).href;
  decoded = source;
  try { decoded = decodeURIComponent(source); } catch { /* Literal percent signs are valid in filenames. */ }
  if (/^file:\/\//i.test(decoded)) {
    const url = new URL(decoded);
    decoded = decodeURIComponent(url.pathname);
    if (/^\/[a-z]:\//i.test(decoded)) decoded = decoded.slice(1);
    if (url.hostname && url.hostname !== 'localhost') decoded = `//${url.hostname}${decoded}`;
  }
  if (/^(?:[a-z]:[\\/]|\/)/i.test(decoded)) return convertFileSrc(decoded);
  if (!sourcePath) throw new Error('Relative image has no document path');
  const directory = sourcePath.slice(0, Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\')) + 1);
  return convertFileSrc(directory + decoded);
}
