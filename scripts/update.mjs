// @ts-nocheck
import fetch from 'node-fetch';
import { getOctokit, context } from '@actions/github';
 
const UPDATE_TAG_NAME = 'updater';
const UPDATE_FILE_NAME = 'update.json';
 
const getSignature = async (url) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/octet-stream' }
  });
  if (!response.ok) {
    throw new Error(`Failed to download updater signature: ${response.status} ${url}`);
  }
  return response.text();
};
 
const updateData = {
  version: '',
  pub_date: new Date().toISOString(),
  platforms: {
    win64: { signature: '', url: '' },
    linux: { signature: '', url: '' },
    darwin: { signature: '', url: '' },
    'darwin-x86_64': { signature: '', url: '' },
    'darwin-aarch64':{signature:'',url:''},
    'linux-x86_64': { signature: '', url: '' },
    'windows-x86_64': { signature: '', url: '' }
  }
};
 
const octokit = getOctokit(process.env.GITHUB_TOKEN);
const options = { owner: context.repo.owner, repo: context.repo.repo };

const isProxy=true;
 
//https://ghproxy.com/https://github.com/cedar12/marknote/releases/download/latest/latest.json

const { data: release } = await octokit.rest.repos.getLatestRelease(options);
updateData.version = release.tag_name.replace(/^v/, '');
// eslint-disable-next-line camelcase
for (let { name, browser_download_url } of release.assets) {
  if(isProxy){
    browser_download_url='https://ghproxy.com/'+browser_download_url;
  }
  if (name.endsWith('.msi.zip')) {
    // eslint-disable-next-line camelcase
    updateData.platforms.win64.url = browser_download_url;
    // eslint-disable-next-line camelcase
    updateData.platforms['windows-x86_64'].url = browser_download_url;
  } else if (name.endsWith('.msi.zip.sig')) {
    // eslint-disable-next-line no-await-in-loop
    const signature = await getSignature(browser_download_url);
    updateData.platforms.win64.signature = signature;
    updateData.platforms['windows-x86_64'].signature = signature;
  } else if (name.endsWith('_aarch64.app.tar.gz')) {
    // eslint-disable-next-line camelcase
    updateData.platforms['darwin-aarch64'].url=browser_download_url;
  } else if (name.endsWith('.app.tar.gz')) {
    // eslint-disable-next-line camelcase
    updateData.platforms.darwin.url = browser_download_url;
    updateData.platforms['darwin-x86_64'].url = browser_download_url;
  } else if (name.endsWith('aarch64.app.tar.gz.sig')) {
    // eslint-disable-next-line no-await-in-loop
    const signature = await getSignature(browser_download_url);
    updateData.platforms['darwin-aarch64'].signature=signature;
  } else if (name.endsWith('.app.tar.gz.sig')) {
    // eslint-disable-next-line no-await-in-loop
    const signature = await getSignature(browser_download_url);
    updateData.platforms.darwin.signature = signature;
    updateData.platforms['darwin-x86_64'].signature = signature;
  } else if (name.endsWith('.AppImage.tar.gz')) {
    // eslint-disable-next-line camelcase
    updateData.platforms.linux.url = browser_download_url;
    // eslint-disable-next-line camelcase
    updateData.platforms['linux-x86_64'].url = browser_download_url;
  } else if (name.endsWith('.AppImage.tar.gz.sig')) {
    // eslint-disable-next-line no-await-in-loop
    const signature = await getSignature(browser_download_url);
    updateData.platforms.linux.signature = signature;
    updateData.platforms['linux-x86_64'].signature = signature;
  }
}

updateData.platforms = Object.fromEntries(
  Object.entries(updateData.platforms).filter(([, platform]) => platform.url && platform.signature)
);
if (Object.keys(updateData.platforms).length === 0) {
  throw new Error(`No signed updater artifacts found in release ${release.tag_name}`);
}
 
const { data: updater } = await octokit.rest.repos.getReleaseByTag({
  ...options,
  tag: UPDATE_TAG_NAME
});
 
for (const { id, name } of updater.assets) {
  if (name === UPDATE_FILE_NAME) {
    // eslint-disable-next-line no-await-in-loop
    await octokit.rest.repos.deleteReleaseAsset({ ...options, asset_id: id });
    break;
  }
}
 
await octokit.rest.repos.uploadReleaseAsset({
  ...options,
  release_id: updater.id,
  name: UPDATE_FILE_NAME,
  data: JSON.stringify(updateData)
});
