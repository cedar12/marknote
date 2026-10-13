export interface FileVersion {
  exists: boolean;
  mtimeNs: string;
  size: number;
  hash: string;
}

export interface MarkdownFileResponse {
  code: number;
  info: string;
  data?: string | null;
  version?: FileVersion | null;
  canonicalPath?: string | null;
  attachmentMapping?: Record<string, string>;
}

export interface FileConflict {
  path: string;
  canonicalPath: string;
  version: FileVersion | null;
  detectedAt: number;
}

export const FILE_SAVED_EVENT = 'marknote-file-saved';

export function normalizeFileVersion(value: unknown): FileVersion | null {
  if (!value || typeof value !== 'object') return null;
  const version = value as FileVersion;
  if (typeof version.exists !== 'boolean' || typeof version.mtimeNs !== 'string' || !/^\d+$/.test(version.mtimeNs)
    || !Number.isSafeInteger(version.size) || version.size < 0 || typeof version.hash !== 'string') return null;
  if (version.exists ? !/^[a-f0-9]{64}$/.test(version.hash) : version.hash !== '' || version.size !== 0) return null;
  return { exists: version.exists, mtimeNs: version.mtimeNs, size: version.size, hash: version.hash };
}

export function sameFileContents(first: FileVersion | null, second: FileVersion | null): boolean {
  return !!first && !!second && first.exists === second.exists && first.size === second.size && first.hash === second.hash;
}

export function fileIdentity(path: string, windows: boolean): string {
  let identity = path.replace(/\\/g, '/');
  if (identity.startsWith('//?/UNC/')) identity = '//' + identity.slice(8);
  else if (identity.startsWith('//?/')) identity = identity.slice(4);
  return windows ? identity.toLowerCase() : identity;
}

export function filePathFromArgument(argument:string,windows:boolean):string {
  if(!/^file:\/\//i.test(argument))return argument;
  const url=new URL(argument);
  const path=decodeURIComponent(url.pathname);
  if(url.hostname&&url.hostname!=='localhost')return windows?'\\\\'+url.hostname+path.replace(/\//g,'\\'):'//'+url.hostname+path;
  return windows&&/^\/[a-z]:\//i.test(path)?path.slice(1):path;
}
