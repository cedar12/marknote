const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src/utils/draftRecovery.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const drafts = {};
new Function('exports', 'require', 'module', compiled)(drafts, require, { exports: drafts });

class MemoryStorage {
  values = new Map(); failure = false;
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] || null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failure) throw new Error('quota'); this.values.set(key, value); }
  removeItem(key) { if (this.failure) throw new Error('disk failure'); this.values.delete(key); }
}

async function main() {
  const storage = new MemoryStorage();
  let now = 1000;
  const repo = new drafts.BrowserDraftRepository(storage, () => now);
  const ownerA = '11111111-1111-4111-8111-111111111111';
  const ownerB = '22222222-2222-4222-8222-222222222222';
  const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const markdown = '# 标题\r\n\r\n**未保存** 📝\r\n\r\n'.repeat(25_000);
  const snapshot = { schemaVersion: 1, id: idA, owner: ownerA, title: 'note.md', sourcePath: 'C:\\notes\\note.md', markdown, updatedAt: now };
  await repo.register(ownerA);
  await repo.write(snapshot);
  await repo.register(ownerB);
  await repo.write({ ...snapshot, id: idB, owner: ownerB, sourcePath: null });
  assert.equal((await repo.list()).length, 0, 'Live windows must not offer each other drafts');
  await assert.rejects(() => repo.claim(idA, ownerB), /draft_in_use/);
  await assert.rejects(() => repo.remove(idA, ownerB), /draft_in_use/);
  await assert.rejects(() => repo.write({ ...snapshot, owner: ownerB }), /draft_in_use/);
  now += drafts.DRAFT_LEASE_MS + 1;
  await repo.heartbeat(ownerB);
  assert.deepEqual((await repo.list()).map(draft => draft.id), [idA], 'Only inactive windows are recoverable');
  const claimed = await repo.claim(idA, ownerB);
  assert.equal(claimed.markdown, markdown, 'Full large Markdown and original newline conventions must survive');
  assert.equal(claimed.sourcePath, snapshot.sourcePath, 'Recovery retains source metadata without writing the source');
  assert.equal((await repo.list()).length, 0);
  storage.failure = true;
  await assert.rejects(() => repo.write({ ...claimed, markdown: 'latest edit' }), /quota/);
  assert.equal(JSON.parse(storage.getItem(drafts.DRAFT_PREFIX + idA)).markdown, markdown, 'A failed write retains the previous draft');
  await assert.rejects(() => repo.remove(idA, ownerB), /disk failure/);
  assert.ok(storage.getItem(drafts.DRAFT_PREFIX + idA), 'A failed removal must preserve recovery data');
  storage.failure = false;
  await repo.remove(idA, ownerB);
  assert.ok(storage.getItem(drafts.DRAFT_PREFIX + idB), 'Removing one draft must never remove another window document');
  storage.setItem(drafts.DRAFT_PREFIX + idA, '{partial');
  repo.release(ownerB);
  assert.deepEqual((await repo.list()).map(draft => draft.id), [idB], 'A corrupt record must not hide healthy drafts');
  for (const id of ['../outside', 'CON', '', 'x'.repeat(36)]) assert.equal(drafts.validDraftId(id), false);
  await assert.rejects(() => repo.remove('../outside', ownerB), /invalid_draft/);
  assert.throws(() => drafts.parseDraft({ ...snapshot, schemaVersion: 2 }), /invalid_draft/);
  assert.equal(drafts.draftByteLength('文档 📝'), 11);
  const active = new Set([ownerB]);
  const accurate = new drafts.BrowserDraftRepository(storage, () => now + 1_000_000, async () => active);
  assert.equal((await accurate.list()).length, 0, 'A live Web Lock protects a background tab even after a lease expires');
  active.clear();
  assert.equal((await accurate.list()).length, 1, 'Releasing a Web Lock makes an interrupted tab recoverable');
  console.log('PASS draft recovery: large Unicode snapshot, live owners, claim protection, independent records, failure retention, corrupt-record isolation and unsafe IDs');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
