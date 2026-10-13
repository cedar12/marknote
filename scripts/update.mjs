import { randomUUID } from 'node:crypto';
import fetch from 'node-fetch';
import { getOctokit, context } from '@actions/github';

const UPDATE_TAG_NAME = 'updater';
const UPDATE_FILE_NAME = 'update.json';
const SIGNATURE_MAX_BYTES = 16 * 1024;
const REQUIRED_PLATFORMS = ['windows-x86_64', 'linux-x86_64', 'darwin-x86_64', 'darwin-aarch64'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;

const releaseTag = (process.env.RELEASE_TAG || (context.ref?.startsWith('refs/tags/') ? context.ref : ''))
  .replace(/^refs\/tags\//, '');
const version = releaseTag.replace(/^v/, '');
if (!releaseTag || !SEMVER.test(version)) {
  throw new Error('RELEASE_TAG or the GitHub tag ref must identify a valid release version.');
}
if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required.');

const octokit = getOctokit(process.env.GITHUB_TOKEN);
const options = { owner: context.repo.owner, repo: context.repo.repo };

function assetUrl(asset) {
  const url = new URL(asset.browser_download_url);
  const parts = url.pathname.split('/').map(decodeURIComponent);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password ||
      url.search || url.hash || parts.length !== 7 || parts[1].toLowerCase() !== options.owner.toLowerCase() ||
      parts[2].toLowerCase() !== options.repo.toLowerCase() || parts[3] !== 'releases' || parts[4] !== 'download' ||
      parts[5] !== releaseTag || parts[6] !== asset.name || asset.state && asset.state !== 'uploaded' ||
      typeof asset.size === 'number' && asset.size <= 0) {
    throw new Error(`Invalid release asset URL or upload state: ${asset.name}`);
  }
  return url.href;
}

function architecture(name) {
  return name.match(/(?:^|[._-])(x86_64|aarch64|amd64|arm64|x64|i686|i386|x86|armv7|armhf|universal)(?=$|[._-])/)?.[1];
}

function artifactPlatform(name) {
  if (name.endsWith('.sig') || /(?:^|[._-])debug(?:[._-]|$)/i.test(name)) return null;
  const arch = architecture(name);
  const x64 = ['x86_64', 'amd64', 'x64'].includes(arch);
  if (name.endsWith('.app.tar.gz')) {
    if (['aarch64', 'arm64'].includes(arch)) return { key: 'darwin-aarch64', priority: 0 };
    if (x64) return { key: 'darwin-x86_64', priority: 0 };
    return null;
  }
  if (!x64) return null;
  // Prefer migration-compatible archives while v1 clients are still supported.
  if (name.endsWith('.msi.zip')) return { key: 'windows-x86_64', priority: 0, legacy: 'win64' };
  if (name.endsWith('.nsis.zip')) return { key: 'windows-x86_64', priority: 1, legacy: 'win64' };
  if (name.endsWith('.msi')) return { key: 'windows-x86_64', priority: 2 };
  if (name.endsWith('-setup.exe')) return { key: 'windows-x86_64', priority: 3 };
  if (name.endsWith('.AppImage.tar.gz')) return { key: 'linux-x86_64', priority: 0, legacy: 'linux' };
  if (name.endsWith('.AppImage')) return { key: 'linux-x86_64', priority: 1 };
  return null;
}

function validateSignature(text, name) {
  const signature = text.trim();
  // Tauri .sig files contain the base64-encoded four-line minisign signature.
  const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!signature || Buffer.byteLength(signature) > SIGNATURE_MAX_BYTES || !base64.test(signature)) {
    throw new Error(`Invalid updater signature: ${name}`);
  }
  const lines = Buffer.from(signature, 'base64').toString('utf8').trim().split(/\r?\n/);
  if (lines.length !== 4 || !lines[0].startsWith('untrusted comment:') || !lines[2].startsWith('trusted comment:') ||
      !base64.test(lines[1]) || Buffer.from(lines[1], 'base64').length !== 74 ||
      !base64.test(lines[3]) || Buffer.from(lines[3], 'base64').length !== 64) {
    throw new Error(`Invalid minisign signature contents: ${name}`);
  }
  return signature;
}

async function getSignature(asset) {
  const url = assetUrl(asset);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/octet-stream' },
    signal: AbortSignal.timeout(30_000),
    size: SIGNATURE_MAX_BYTES
  });
  if (!response.ok) throw new Error(`Failed to download updater signature: ${response.status} ${asset.name}`);
  return validateSignature(await response.text(), asset.name);
}

const { data: release } = await octokit.rest.repos.getReleaseByTag({ ...options, tag: releaseTag });
if (release.tag_name !== releaseTag || release.draft || !Array.isArray(release.assets)) {
  throw new Error(`Release ${releaseTag} is not a published release with assets.`);
}
const assets = new Map();
for (const asset of release.assets) {
  if (assets.has(asset.name)) throw new Error(`Duplicate release asset: ${asset.name}`);
  assets.set(asset.name, asset);
}
const selected = new Map();
for (const asset of release.assets) {
  const platform = artifactPlatform(asset.name);
  if (!platform || !assets.has(`${asset.name}.sig`)) continue;
  const previous = selected.get(platform.key);
  if (!previous || platform.priority < previous.platform.priority ||
      platform.priority === previous.platform.priority && asset.name.localeCompare(previous.asset.name, 'en') < 0) {
    selected.set(platform.key, { asset, platform, signature: assets.get(`${asset.name}.sig`) });
  }
}
for (const platform of REQUIRED_PLATFORMS) {
  if (!selected.has(platform)) throw new Error(`Missing signed updater artifact for ${platform} in ${releaseTag}.`);
}

const updateData = {
  version,
  pub_date: release.published_at && Number.isFinite(Date.parse(release.published_at))
    ? new Date(release.published_at).toISOString() : new Date().toISOString(),
  platforms: {}
};
for (const key of REQUIRED_PLATFORMS) {
  const { asset, platform, signature } = selected.get(key);
  const entry = { url: assetUrl(asset), signature: await getSignature(signature) };
  updateData.platforms[key] = entry;
  if (platform.legacy) updateData.platforms[platform.legacy] = entry;
  if (key === 'darwin-x86_64') updateData.platforms.darwin = entry;
}

// Every required URL and signature is validated before any updater asset changes.
const { data: updater } = await octokit.rest.repos.getReleaseByTag({ ...options, tag: UPDATE_TAG_NAME });
const oldManifest = updater.assets.find((asset) => asset.name === UPDATE_FILE_NAME);
const suffix = randomUUID();
const pendingName = `${UPDATE_FILE_NAME}.pending-${suffix}`;
const backupName = `${UPDATE_FILE_NAME}.previous-${suffix}`;
const { data: staged } = await octokit.rest.repos.uploadReleaseAsset({
  ...options,
  release_id: updater.id,
  name: pendingName,
  headers: { 'content-type': 'application/json' },
  data: JSON.stringify(updateData)
});
if (!Number.isSafeInteger(staged.id) || staged.id <= 0) throw new Error('GitHub did not return the staged manifest asset id.');

let oldRenameAttempted = false;
try {
  if (oldManifest) {
    oldRenameAttempted = true;
    await octokit.rest.repos.updateReleaseAsset({ ...options, asset_id: oldManifest.id, name: backupName });
  }
  await octokit.rest.repos.updateReleaseAsset({ ...options, asset_id: staged.id, name: UPDATE_FILE_NAME });
} catch (error) {
  // An API response can fail after GitHub applied the rename. Move the staged
  // asset aside first, then restore the old name; never delete the old bytes.
  try {
    await octokit.rest.repos.updateReleaseAsset({ ...options, asset_id: staged.id, name: pendingName });
    if (oldRenameAttempted) {
      await octokit.rest.repos.updateReleaseAsset({ ...options, asset_id: oldManifest.id, name: UPDATE_FILE_NAME });
    }
    await octokit.rest.repos.deleteReleaseAsset({ ...options, asset_id: staged.id });
  } catch (rollbackError) {
    throw new AggregateError([error, rollbackError], `Manifest publication failed. Retained assets ${pendingName} / ${backupName} require review.`);
  }
  throw error;
}
if (oldManifest) {
  try {
    await octokit.rest.repos.deleteReleaseAsset({ ...options, asset_id: oldManifest.id });
  } catch (error) {
    // The new manifest is already published; an orphaned backup is harmless.
    console.warn(`Published ${releaseTag}; could not remove backup asset ${backupName}: ${error.message}`);
  }
}
console.log(`Published updater manifest for ${releaseTag} with all ${REQUIRED_PLATFORMS.length} required platforms.`);
