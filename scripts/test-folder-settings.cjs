const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/utils', name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  new Function('exports', 'require', 'module', compiled)(exports, require, { exports });
  return exports;
}
const folder = load('folderNavigation');
const image = load('imagePreferences');
const entries = folder.normalizeFolderEntries([
  { name: 'note10.md', dir: false, path: 'C:\\notes\\note10.md' },
  { name: 'Note2.md', dir: false, path: 'C:\\notes\\Note2.md' },
  { name: 'zFolder', dir: true, path: 'C:\\notes\\zFolder' },
  { name: 'note1.md', dir: false, path: 'C:\\notes\\note1.md' },
], 'en');
assert.deepEqual(entries.map(entry => entry.name), ['zFolder', 'note1.md', 'Note2.md', 'note10.md']);
assert.equal(entries[0].file, false);
assert.equal(folder.folderEntryMatches(entries[2], ' NOTE2 '), true);
assert.equal(folder.folderEntryMatches({ name: '报告.md' }, '报告'), true);
assert.throws(() => folder.normalizeFolderEntries([{ name: 'bad', dir: true }], 'en'), /invalid_folder_entry/);
assert.throws(() => folder.normalizeFolderEntries(undefined, 'en'), /invalid_folder_entries/);
assert.equal(folder.folderLabel('C:\\notes\\'), 'notes');
assert.deepEqual(folder.sidebarWidthBounds(280), { min: 184, max: 184 }, 'Narrow bounds must never reverse min/max and must retain the document plus resize handle');
assert.equal(folder.clampSidebarWidth(500, 184, 184), 184);
for (const value of [NaN, 'bad', '20', Infinity, -1]) assert.equal(folder.normalizeSidebarWidth(value), 220);
assert.equal(folder.normalizeSidebarWidth('430'), 430);
assert.equal(image.validateImagePreferences({ saveType: 'sepc', path: '' }, 'windows'), 'imagePathRequired');
assert.equal(image.validateImagePreferences({ saveType: 'sepc', path: 'relative/assets' }, 'windows'), 'imagePathAbsolute');
assert.equal(image.validateImagePreferences({ saveType: 'sepc', path: 'C:\\notes\\assets' }, 'windows'), null);
assert.equal(image.validateImagePreferences({ saveType: 'sepc', path: '/home/user/assets' }, 'windows'), 'imagePathAbsolute');
assert.equal(image.validateImagePreferences({ saveType: 'sepc', path: '/home/user/assets' }, 'linux'), null);
assert.equal(image.validateImagePreferences({ saveType: 'default', path: 'C:\\notes' }), 'imagePathRelative');
assert.equal(image.validateImagePreferences({ saveType: 'default', path: '/relative/assets' }, 'windows'), 'imagePathRelative');
assert.equal(image.validateImagePreferences({ saveType: 'default', path: '\\relative\\assets' }, 'windows'), 'imagePathRelative');
assert.equal(image.validateImagePreferences({ saveType: 'default', path: '${filename}.assets' }), null);
assert.equal(image.validateImagePreferences({ saveType: 'default', path: 'attachments/${filename}' }), null);
assert.equal(image.validateImagePreferences({ saveType: 'picgo', path: 'http://127.0.0.1:36677/upload' }), null);
assert.equal(image.validateImagePreferences({ saveType: 'picgo', path: 'https://example.test/upload?token=a' }), null);
assert.equal(image.validateImagePreferences({ saveType: 'picgo', path: 'C:\\PicGo\\PicGo.exe' }, 'windows'), null);
for (const value of ['javascript:alert(1)', 'file:///tmp/picgo', 'not a URL', 'relative.exe']) {
  assert.equal(image.validateImagePreferences({ saveType: 'picgo', path: value }, 'windows'), 'picgoPathInvalid');
}
assert.equal(image.validateImagePreferences({ saveType: 'sepc', path: 'C:\\a\u0000b' }), 'imagePathInvalid');
assert.throws(() => image.readImagePreferences({ saveType: 'spec', path: 'C:\\assets' }), /invalid_image_preferences/);
console.log('PASS folder/settings: natural ordering, Unicode/case filtering, malformed responses, narrow width bounds and platform-aware image/CLI/HTTP configuration validation');
