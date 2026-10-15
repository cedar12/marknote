export type CodeThemeMode = 'light' | 'dark';

const pairs = [
  ['github', 'github-dark'],
  ['atom-one-light', 'atom-one-dark'],
  ['nnfx-light', 'nnfx-dark'],
  ['default', 'dark'],
] as const;

export const CODE_THEME_OPTIONS: readonly { value: string; type: CodeThemeMode }[] = [
  ...pairs.flatMap(([light, dark]) => [
    { value: light, type: 'light' as const },
    { value: dark, type: 'dark' as const },
  ]),
  ...['idea', 'intellij-light', 'vs', 'xcode', 'googlecode'].map(value => ({ value, type: 'light' as const })),
  ...['codepen-embed', 'nord'].map(value => ({ value, type: 'dark' as const })),
];

export function isCodeTheme(value: unknown): value is string {
  return typeof value === 'string' && CODE_THEME_OPTIONS.some(theme => theme.value === value);
}

// Keep the saved style unchanged so switching back restores unpaired themes too.
export function resolveCodeTheme(preference: unknown, mode: CodeThemeMode): string {
  const selected = CODE_THEME_OPTIONS.find(theme => theme.value === preference);
  if (selected?.type === mode) return selected.value;
  const pair = pairs.find(([light, dark]) => preference === light || preference === dark);
  return pair?.[mode === 'light' ? 0 : 1] || (mode === 'light' ? 'github' : 'github-dark');
}
