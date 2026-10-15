const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/codeTheme.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const { CODE_THEME_OPTIONS, isCodeTheme, resolveCodeTheme } = exportsObject;

assert.equal(new Set(CODE_THEME_OPTIONS.map(theme => theme.value)).size, CODE_THEME_OPTIONS.length);
for (const theme of CODE_THEME_OPTIONS) {
  assert.equal(isCodeTheme(theme.value), true);
  assert.equal(resolveCodeTheme(theme.value, theme.type), theme.value, 'the saved style is restored in its original mode');
  for (const mode of ['light', 'dark']) {
    const active = resolveCodeTheme(theme.value, mode);
    assert.equal(CODE_THEME_OPTIONS.find(theme => theme.value === active)?.type, mode, 'every supported palette resolves to the active mode');
  }
}
for (const [light, dark] of [['github', 'github-dark'], ['atom-one-light', 'atom-one-dark'], ['nnfx-light', 'nnfx-dark'], ['default', 'dark']]) {
  assert.equal(resolveCodeTheme(light, 'dark'), dark);
  assert.equal(resolveCodeTheme(dark, 'light'), light);
}
for (const light of ['idea', 'intellij-light', 'vs', 'xcode', 'googlecode']) assert.equal(resolveCodeTheme(light, 'dark'), 'github-dark');
for (const dark of ['codepen-embed', 'nord']) assert.equal(resolveCodeTheme(dark, 'light'), 'github');
for (const invalid of [undefined, null, '', 'missing', 'GitHub', {}, 1]) {
  assert.equal(isCodeTheme(invalid), false);
  assert.equal(resolveCodeTheme(invalid, 'light'), 'github');
  assert.equal(resolveCodeTheme(invalid, 'dark'), 'github-dark');
}
const styles = fs.readFileSync(path.join(__dirname, '../src/scss/codeTheme.scss'), 'utf8');
for (const theme of CODE_THEME_OPTIONS) assert(styles.includes(`&${theme.value}{`), 'every offered palette has a bundled stylesheet');
console.log('PASS code theme palettes: all supported modes, counterpart pairs, unpaired restoration, invalid preferences and bundled styles');
