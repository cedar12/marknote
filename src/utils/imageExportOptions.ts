export interface ImageExportOptions {
  format: 'png' | 'jpeg';
  width: number;
  scale: 1 | 2;
  background: 'theme' | 'white' | 'transparent';
  quality: number;
}

export const DEFAULT_IMAGE_EXPORT_OPTIONS: Readonly<ImageExportOptions> = Object.freeze({
  format: 'png',
  width: 960,
  scale: 1,
  background: 'theme',
  quality: 0.9,
});

export const IMAGE_EXPORT_MIN_WIDTH = 360;
export const IMAGE_EXPORT_MAX_WIDTH = 2000;
const STORAGE_KEY = 'MarkNoteImageExportOptions';

export function normalizeImageExportOptions(value: unknown): ImageExportOptions {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<keyof ImageExportOptions, unknown>>
    : {};
  const format = source.format === 'jpeg' ? 'jpeg' : 'png';
  let background: ImageExportOptions['background'] = source.background === 'white' || source.background === 'transparent'
    ? source.background : 'theme';
  if (format === 'jpeg' && background === 'transparent') background = 'white';

  return {
    format,
    width: typeof source.width === 'number' && Number.isFinite(source.width)
      ? Math.round(Math.min(IMAGE_EXPORT_MAX_WIDTH, Math.max(IMAGE_EXPORT_MIN_WIDTH, source.width)))
      : DEFAULT_IMAGE_EXPORT_OPTIONS.width,
    scale: source.scale === 2 ? 2 : 1,
    background,
    quality: typeof source.quality === 'number' && Number.isFinite(source.quality)
      ? Math.min(1, Math.max(0.5, source.quality))
      : DEFAULT_IMAGE_EXPORT_OPTIONS.quality,
  };
}

export function readImageExportOptions(): ImageExportOptions {
  try {
    return normalizeImageExportOptions(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_IMAGE_EXPORT_OPTIONS };
  }
}

export function saveImageExportOptions(options: ImageExportOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeImageExportOptions(options)));
  } catch {
    // Preference storage can be unavailable; the current export still works.
  }
}
