const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/sidebarPreferences.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const result = {};
new Function('exports', 'require', 'module', compiled)(result, require, { exports: result });
const { normalizeSidebarVisible, readSidebarVisible, writeSidebarVisible, SIDEBAR_VISIBLE_KEY } = result;
assert.equal(normalizeSidebarVisible('true'), true);
assert.equal(normalizeSidebarVisible('false', true), false);
for (const invalid of [null, undefined, '', '0', '1', 'True', 'FALSE', ' true ', '{}', 'null', true, false, 0, 1]) {
  assert.equal(normalizeSidebarVisible(invalid), false);
  assert.equal(normalizeSidebarVisible(invalid, true), true);
}
const items = new Map(), writes = [];
const storage = { getItem(key) { return items.get(key) ?? null; }, setItem(key, value) { writes.push([key, value]); items.set(key, value); } };
assert.equal(readSidebarVisible(false, storage), false);
assert.equal(readSidebarVisible(true, storage), true);
assert.equal(writeSidebarVisible(true, storage), true);
assert.equal(readSidebarVisible(false, storage), true);
assert.equal(writeSidebarVisible(false, storage), true);
assert.equal(readSidebarVisible(true, storage), false);
assert.deepEqual(writes, [[SIDEBAR_VISIBLE_KEY, 'true'], [SIDEBAR_VISIBLE_KEY, 'false']]);
assert.equal(writeSidebarVisible('false', storage), false, 'The writer must not coerce a truthy string to true');
assert.equal(writes.length, 2);
const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota exceeded'); } };
assert.equal(readSidebarVisible(true, denied), true);
assert.equal(writeSidebarVisible(true, denied), false);
const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage property access denied'); } });
  assert.equal(readSidebarVisible(true), true);
  assert.equal(writeSidebarVisible(true), false);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
  assert.equal(readSidebarVisible(false), false);
  assert.equal(writeSidebarVisible(false), false);
} finally {
  if (prior) Object.defineProperty(globalThis, 'localStorage', prior); else delete globalThis.localStorage;
}
console.log('PASS sidebar preferences: strict true/false parsing, round-trip writes, fallback, invalid input, denied access and unavailable storage');
