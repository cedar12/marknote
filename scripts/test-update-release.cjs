const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.update-release-test-'));
const tag = 'v0.0.10-alpha.1';
const oldData = '{"version":"0.0.9-alpha9","platforms":{"old":"preserve these bytes"}}';
const signature = Buffer.from([
  'untrusted comment: signature from minisign secret key',
  Buffer.concat([Buffer.from('ED'), Buffer.alloc(72, 1)]).toString('base64'),
  'trusted comment: timestamp:1\tfile:MarkNote',
  Buffer.alloc(64, 2).toString('base64')
].join('\n') + '\n').toString('base64');
const legacyNames = [
  'MarkNote_0.0.10-alpha.1_x64_en-US.msi.zip',
  'mark-note_0.0.10-alpha.1_amd64.AppImage.tar.gz',
  'MarkNote_x64.app.tar.gz',
  'MarkNote_aarch64.app.tar.gz'
];

function makeRelease(names = legacyNames, releaseTag = tag) {
  return {
    id: 10, tag_name: releaseTag, draft: false, published_at: '2026-10-13T01:02:03Z',
    assets: names.flatMap((name, index) => [name, `${name}.sig`].map((assetName, offset) => ({
      id: 10 + index * 2 + offset, name: assetName, size: offset ? 512 : 1024, state: 'uploaded',
      browser_download_url: `https://github.com/cedar12/marknote/releases/download/${releaseTag}/${assetName}`
    })))
  };
}

fs.writeFileSync(path.join(temporary, 'register.mjs'), "import { register } from 'node:module'; register('./loader.mjs', import.meta.url);\n");
fs.writeFileSync(path.join(temporary, 'loader.mjs'), `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'node-fetch' || specifier === '@actions/github') {
    return { url: new URL('./mock.mjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`);
fs.writeFileSync(path.join(temporary, 'mock.mjs'), `
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync(process.env.MARKNOTE_UPDATE_FIXTURE, 'utf8'));
const state = { assets: structuredClone(fixture.updater.assets), nextId: 202, failureTriggered: false };
const save = () => writeFileSync(process.env.MARKNOTE_UPDATE_STATE, JSON.stringify(state));
const record = (method, args) => appendFileSync(process.env.MARKNOTE_UPDATE_EVENTS, JSON.stringify({ method, args }) + '\\n');
process.on('exit', save);
export const context = { repo: { owner: 'cedar12', repo: 'marknote' }, ref: fixture.ref };
export const getOctokit = () => ({ rest: { repos: {
  async getLatestRelease(args) { record('getLatestRelease', args); throw new Error('Latest release lookup is forbidden'); },
  async getReleaseByTag(args) {
    record('getReleaseByTag', args);
    if (args.tag === 'updater') return { data: { ...fixture.updater, assets: structuredClone(state.assets) } };
    if (!fixture.releases[args.tag]) throw new Error('Release not found: ' + args.tag);
    return { data: fixture.releases[args.tag] };
  },
  async uploadReleaseAsset(args) {
    record('uploadReleaseAsset', args);
    if (fixture.fail === 'upload') throw new Error('Mock upload failed');
    const asset = { id: state.nextId++, name: args.name, data: args.data };
    state.assets.push(asset); save();
    return { data: fixture.fail === 'uploadId' ? {} : asset };
  },
  async updateReleaseAsset(args) {
    record('updateReleaseAsset', args);
    const asset = state.assets.find(item => item.id === args.asset_id);
    if (!asset) throw new Error('Asset not found');
    const oldRename = args.asset_id === 101 && args.name.includes('.previous-');
    const publish = args.asset_id !== 101 && args.name === 'update.json';
    const shouldFail = !state.failureTriggered && (
      oldRename && ['renameOld', 'renameOldAfter'].includes(fixture.fail) ||
      publish && ['publish', 'publishAfter'].includes(fixture.fail));
    if (shouldFail && !fixture.fail.endsWith('After')) {
      state.failureTriggered = true; save(); throw new Error('Mock rename failed');
    }
    if (state.assets.some(item => item.id !== asset.id && item.name === args.name)) throw new Error('Asset name already exists');
    asset.name = args.name; save();
    if (shouldFail) { state.failureTriggered = true; save(); throw new Error('Response lost after rename'); }
    return { data: asset };
  },
  async deleteReleaseAsset(args) {
    record('deleteReleaseAsset', args);
    if (fixture.fail === 'cleanup' && args.asset_id === 101) throw new Error('Backup cleanup failed');
    state.assets = state.assets.filter(item => item.id !== args.asset_id); save();
    return { status: 204 };
  }
} } });
export default async function fetch(url, options) {
  record('fetch', { url, method: options.method, timeout: Boolean(options.signal), size: options.size });
  if (!Object.values(fixture.releases).some(release => release.assets.some(asset => asset.browser_download_url === url && asset.name.endsWith('.sig')))) {
    throw new Error('Unexpected signature fetch: ' + url);
  }
  const response = fixture.responses[url] || { status: 200, body: fixture.signature };
  if (response.error) throw new Error(response.error);
  return { ok: response.status === 200, status: response.status, text: async () => response.body };
}
`);

let checks = 0;
function run(name, amend = () => {}, success = true) {
  const fixture = {
    releaseTag: tag, ref: 'refs/tags/v9.9.9', signature, responses: {},
    releases: { [tag]: makeRelease(), 'v9.9.9': makeRelease(legacyNames, 'v9.9.9') },
    updater: { id: 100, assets: [{ id: 101, name: 'update.json', data: oldData }] }
  };
  amend(fixture);
  const fixturePath = path.join(temporary, 'fixture.json');
  const statePath = path.join(temporary, 'state.json');
  const eventsPath = path.join(temporary, 'events.jsonl');
  fs.writeFileSync(fixturePath, JSON.stringify(fixture));
  fs.writeFileSync(eventsPath, '');
  fs.rmSync(statePath, { force: true });
  const child = spawnSync(process.execPath, [
    '--import', pathToFileURL(path.join(temporary, 'register.mjs')).href,
    path.join(root, 'scripts', 'update.mjs')
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, GITHUB_TOKEN: 'mock-token-never-sent', RELEASE_TAG: fixture.releaseTag,
      MARKNOTE_UPDATE_FIXTURE: fixturePath, MARKNOTE_UPDATE_STATE: statePath, MARKNOTE_UPDATE_EVENTS: eventsPath }
  });
  assert.equal(child.status, success ? 0 : 1, `${name}: ${child.error || child.stderr || child.stdout}`);
  const events = fs.readFileSync(eventsPath, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { assets: fixture.updater.assets };
  assert.ok(!events.some(event => event.method === 'getLatestRelease'), `${name}: must bind the requested tag`);
  checks++;
  console.log(`PASS ${name}`);
  return { fixture, events, state, child };
}
function unchanged(result) {
  assert.deepEqual(result.state.assets, result.fixture.updater.assets);
  assert.ok(!result.events.some(event => ['uploadReleaseAsset', 'updateReleaseAsset', 'deleteReleaseAsset'].includes(event.method)));
}
function oldRestored(result) {
  assert.deepEqual(result.state.assets, [{ id: 101, name: 'update.json', data: oldData }]);
  assert.ok(!result.events.some(event => event.method === 'deleteReleaseAsset' && event.args.asset_id === 101));
}

try {
  const selected = run('explicit tag beats a different latest/context tag');
  assert.equal(selected.events[0].args.tag, tag);
  assert.equal(selected.state.assets.length, 1);
  const manifest = JSON.parse(selected.state.assets[0].data);
  assert.equal(selected.state.assets[0].name, 'update.json');
  assert.equal(manifest.version, '0.0.10-alpha.1');
  assert.equal(manifest.pub_date, '2026-10-13T01:02:03.000Z');
  assert.deepEqual(Object.keys(manifest.platforms).sort(), ['darwin', 'darwin-aarch64', 'darwin-x86_64', 'linux', 'linux-x86_64', 'win64', 'windows-x86_64'].sort());
  for (const platform of Object.values(manifest.platforms)) {
    assert.ok(platform.url.startsWith(`https://github.com/cedar12/marknote/releases/download/${tag}/`));
    assert.equal(platform.signature, signature);
  }
  const firstMutation = selected.events.findIndex(event => event.method === 'uploadReleaseAsset');
  assert.equal(selected.events.slice(0, firstMutation).filter(event => event.method === 'fetch').length, 4);
  assert.ok(selected.events.filter(event => event.method === 'fetch').every(event => event.args.timeout && event.args.size === 16384));
  assert.ok(selected.events.findIndex(event => event.method === 'deleteReleaseAsset') > selected.events.findLastIndex(event => event.method === 'updateReleaseAsset'));

  const fallback = run('context tag fallback', fixture => { fixture.releaseTag = ''; fixture.ref = `refs/tags/${tag}`; });
  assert.equal(fallback.events[0].args.tag, tag);
  run('RELEASE_TAG accepts a full tag ref', fixture => { fixture.releaseTag = `refs/tags/${tag}`; });
  unchanged(run('branch ref refuses publishing', fixture => { fixture.releaseTag = ''; fixture.ref = 'refs/heads/dev'; }, false));
  unchanged(run('invalid SemVer refuses publishing', fixture => { fixture.releaseTag = 'v0.0.10-alpha.01'; }, false));
  unchanged(run('wrong returned release refuses publishing', fixture => { fixture.releases[tag].tag_name = 'v9.9.9'; }, false));
  unchanged(run('draft release refuses publishing', fixture => { fixture.releases[tag].draft = true; }, false));
  unchanged(run('missing mac x64 preserves old manifest', fixture => {
    fixture.releases[tag].assets = fixture.releases[tag].assets.filter(asset => !asset.name.includes('_x64.app.tar.gz'));
  }, false));
  unchanged(run('unrelated signature cannot complete a platform', fixture => {
    fixture.releases[tag].assets.find(asset => asset.name.endsWith('.msi.zip.sig')).name = 'unrelated_x64.msi.zip.sig';
  }, false));
  unchanged(run('wrong architecture cannot complete a platform', fixture => {
    fixture.releases[tag] = makeRelease(legacyNames.map(name => name.endsWith('.AppImage.tar.gz') ? name.replace('_amd64.', '_arm64.') : name));
  }, false));
  unchanged(run('proxy URL preserves old manifest', fixture => {
    fixture.releases[tag].assets[0].browser_download_url = 'https://ghproxy.com/' + fixture.releases[tag].assets[0].browser_download_url;
  }, false));
  unchanged(run('different tag URL preserves old manifest', fixture => {
    fixture.releases[tag].assets[0].browser_download_url = fixture.releases[tag].assets[0].browser_download_url.replace(tag, 'v0.0.9-alpha9');
  }, false));
  unchanged(run('signature HTTP failure preserves old manifest', fixture => {
    fixture.responses[fixture.releases[tag].assets[1].browser_download_url] = { status: 503, body: 'unavailable' };
  }, false));
  unchanged(run('signature timeout preserves old manifest', fixture => {
    fixture.responses[fixture.releases[tag].assets[1].browser_download_url] = { error: 'Mock request aborted' };
  }, false));
  unchanged(run('HTML signature rejects before mutation', fixture => { fixture.signature = '<html>proxy error</html>'; }, false));
  unchanged(run('base64 error text rejects before mutation', fixture => { fixture.signature = Buffer.from('error').toString('base64'); }, false));
  unchanged(run('oversized signature rejects before mutation', fixture => { fixture.signature = 'A'.repeat(16388); }, false));
  unchanged(run('duplicate artifact rejects before mutation', fixture => {
    fixture.releases[tag].assets.push(fixture.releases[tag].assets[0]);
  }, false));
  const modern = run('modern Tauri v2 artifact schema and case-insensitive project prefix', fixture => {
    fixture.releases[tag] = makeRelease(['MARKNOTE_0.0.10-alpha.1_x86_64_en-US.msi', 'marknote_0.0.10-alpha.1_amd64.AppImage', 'marknote_x64.app.tar.gz', 'marknote_arm64.app.tar.gz']);
  });
  const modernManifest = JSON.parse(modern.state.assets[0].data);
  assert.ok(modernManifest.platforms['windows-x86_64'].url.endsWith('.msi'));
  assert.ok(modernManifest.platforms['linux-x86_64'].url.endsWith('.AppImage'));
  assert.ok(!modernManifest.platforms.win64 && !modernManifest.platforms.linux);
  const nsis = run('NSIS updater archive fallback', fixture => {
    fixture.releases[tag] = makeRelease(legacyNames.map(name => name.endsWith('.msi.zip') ? 'MarkNote_0.0.10-alpha.1_x64-setup.nsis.zip' : name));
  });
  assert.ok(JSON.parse(nsis.state.assets[0].data).platforms['windows-x86_64'].url.endsWith('.nsis.zip'));
  const installer = run('NSIS standalone installer fallback', fixture => {
    fixture.releases[tag] = makeRelease(legacyNames.map(name => name.endsWith('.msi.zip') ? 'MarkNote_0.0.10-alpha.1_x64-setup.exe' : name));
  });
  assert.ok(JSON.parse(installer.state.assets[0].data).platforms['windows-x86_64'].url.endsWith('-setup.exe'));
  oldRestored(run('upload failure leaves old manifest in place', fixture => { fixture.fail = 'upload'; }, false));
  for (const failure of ['renameOld', 'renameOldAfter', 'publish', 'publishAfter']) {
    oldRestored(run(`${failure} failure rolls back original asset bytes/name`, fixture => { fixture.fail = failure; }, false));
  }
  const cleanup = run('backup cleanup failure keeps the newly published manifest', fixture => { fixture.fail = 'cleanup'; });
  assert.equal(JSON.parse(cleanup.state.assets.find(asset => asset.name === 'update.json').data).version, '0.0.10-alpha.1');
  assert.ok(cleanup.state.assets.some(asset => asset.id === 101 && asset.data === oldData));
  const first = run('first publication without an old manifest', fixture => { fixture.updater.assets = []; });
  assert.equal(first.state.assets.length, 1);
  assert.equal(first.state.assets[0].name, 'update.json');
  console.log(`Updater release regressions passed (${checks} groups; real entry point, mocked GitHub/fetch only).`);
} finally {
  const resolved = path.resolve(temporary);
  if (path.dirname(resolved) !== root || !path.basename(resolved).startsWith('.update-release-test-')) throw new Error('Unsafe test cleanup path');
  fs.rmSync(resolved, { recursive: true, force: true });
}
