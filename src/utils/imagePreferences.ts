export type ImageSaveType = 'default' | 'sepc' | 'picgo';
export interface ImagePreferences { saveType: ImageSaveType; path: string }
export const IMAGE_PREFERENCES_KEY = 'imagePreferences';
export const DEFAULT_IMAGE_PATHS: Record<ImageSaveType, string> = {
  default: '${filename}.assets', sepc: '', picgo: 'http://127.0.0.1:36677/upload',
};

export function isAbsoluteImagePath(path: string, platform = 'any'): boolean {
  const windows = /^[A-Za-z]:[\\/]/.test(path) || /^\\\\[^\\/]+[\\/][^\\/]+/.test(path);
  if (platform === 'windows') return windows;
  if (platform === 'linux' || platform === 'macos') return path.startsWith('/');
  return path.startsWith('/') || windows;
}

export function validateImagePreferences(value: ImagePreferences, platform = 'any'): string | null {
  const path = value.path.trim();
  if (!path) return 'imagePathRequired';
  if (path.length > 32768 || /[\u0000-\u001f\u007f-\u009f]/.test(path)) return 'imagePathInvalid';
  if (value.saveType === 'default') {
    if (path.startsWith('/') || path.startsWith('\\') || isAbsoluteImagePath(path) || /^[A-Za-z]:/.test(path)) return 'imagePathRelative';
  } else if (value.saveType === 'sepc') {
    if (!isAbsoluteImagePath(path, platform)) return 'imagePathAbsolute';
  } else if (value.saveType === 'picgo') {
    if (isAbsoluteImagePath(path, platform)) return null;
    try {
      const url = new URL(path);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return 'picgoPathInvalid';
    } catch { return 'picgoPathInvalid'; }
  } else return 'imagePathInvalid';
  return null;
}

export function readImagePreferences(value: unknown): ImagePreferences {
  if (!value || typeof value !== 'object') throw new Error('invalid_image_preferences');
  const input = value as Record<string, unknown>;
  if (!['default', 'sepc', 'picgo'].includes(String(input.saveType)) || typeof input.path !== 'string') throw new Error('invalid_image_preferences');
  return { saveType: input.saveType as ImageSaveType, path: input.path };
}
