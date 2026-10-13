<template>
  <section class="folder-container" :aria-label="t('folder')" :aria-busy="pending > 0">
    <div class="folder-toolbar">
      <span v-if="appStore.folder" class="folder-root" :title="appStore.folder">{{ folderLabel(appStore.folder) }}</span>
      <button type="button" :disabled="pending > 0 || opening || !appStore.folder" :aria-label="t('refreshFolder')" :title="t('refreshFolder')" @click="refreshFolder"><Refresh aria-hidden="true" /></button>
    </div>
    <div class="folder-search">
      <ElInput ref="searchInput" v-model="filterText" size="small" :placeholder="t('filterLoadedFiles')" :aria-label="t('filterLoadedFiles')" :disabled="!appStore.folder" @compositionstart="composing = true" @compositionend="compositionEnded">
        <template #suffix>
          <button v-if="filterText" type="button" class="folder-clear" :aria-label="t('clearFolderFilter')" :title="t('clearFolderFilter')" @click="clearFilter"><CloseSmall aria-hidden="true" /></button>
          <Search v-else aria-hidden="true" />
        </template>
      </ElInput>
    </div>
    <p v-if="appStore.folder" class="folder-filter-hint">{{ t('folderFilterScopeHint') }}</p>
    <div v-for="failure in failures" :key="failure.path" class="folder-error" role="alert">
      <span>{{ t('folderReadFailed', { folder: failure.name }) }}</span>
      <button type="button" :disabled="pending > 0" @click="retryDirectory(failure.path)">{{ t('retry') }}</button>
    </div>
    <div v-if="openFailure" class="folder-error" role="alert">
      <span>{{ t('folderOpenFileFailed', { file: folderLabel(openFailure) }) }}</span>
      <button type="button" :disabled="opening || documentBusy" @click="openFile(openFailure)">{{ t('retry') }}</button>
    </div>
    <ElScrollbar class="folder-scrollbar" v-loading.compact="pending > 0">
      <div v-if="!appStore.folder" class="folder-empty" role="status">
        <p>{{ t('noFolderOpen') }}</p>
        <button type="button" @click="menuStore.setKey({ key: 'openFolder', label: t('openFolder') })">{{ t('openFolder') }}</button>
      </div>
      <p v-else-if="rootLoaded && !rootCount && !pending && !failures.length" class="folder-empty" role="status">{{ t('emptyMarkdownFolder') }}</p>
      <p v-else-if="query && !hasMatches && !pending" class="folder-empty" role="status">{{ t('noMatchingLoadedFiles') }}</p>
      <ElTree v-if="appStore.folder" v-show="!query || hasMatches" :key="treeVersion" ref="treeRef" :load="loadNode" lazy node-key="path" :props="treeProps" :default-expanded-keys="expandedKeys" :empty-text="''" :filter-node-method="filterNode" :highlight-current="true" @node-click="nodeClick">
        <template #default="{ node, data }">
          <span class="folder-tree-node">
            <span class="file-type-icon" :class="{ 'file-type-dir': data.dir }" aria-hidden="true">
              <FolderOpen v-if="data.dir && node.expanded" theme="filled" />
              <FolderClose v-else-if="data.dir" theme="filled" />
              <img v-else :src="logoPng" alt="" class="img-icon" />
            </span>
            <span class="folder-node-name" :title="data.path">{{ node.label }}</span>
          </span>
        </template>
      </ElTree>
    </ElScrollbar>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElTree, ElScrollbar, ElInput, type InputInstance } from 'element-plus';
import { FolderClose, FolderOpen, Search, CloseSmall, Refresh } from '@icon-park/vue-next';
import type Node from 'element-plus/es/components/tree/src/model/node';
import { ls } from '../api/file';
import { useEditorStore } from '../store/editor';
import { useAppStore } from '../store/app';
import { useMenuStore } from '../store/menu';
import { folderEntryMatches, folderLabel, normalizeFolderEntries, type FolderEntry } from '../utils/folderNavigation';
import logoPng from '../assets/logo.png';

const { t, locale } = useI18n();
const appStore = useAppStore();
const editorStore = useEditorStore();
const menuStore = useMenuStore();
const treeRef = ref<InstanceType<typeof ElTree>>();
const searchInput = ref<InputInstance>();
const treeProps = { label: 'name', children: 'children', isLeaf: 'file' };
const treeVersion = ref(0);
const pending = ref(0);
const rootLoaded = ref(false);
const rootCount = ref(0);
const loaded = shallowRef(new Map<string, FolderEntry>());
const failures = ref<{ path: string; name: string }[]>([]);
const filterText = ref('');
const query = ref('');
const composing = ref(false);
const opening = ref(false);
const openFailure = ref<string | null>(null);
const expandedKeys = ref<string[]>([]);
let expandedBeforeFilter: string[] | null = null;
let cachedRoot: FolderEntry[] | null = null;
let alive = true;
let filterGeneration = 0;
const documentBusy = computed(() => appStore.lifecycleBusy || appStore.exporting || editorStore.loading || editorStore.renderingDocument || editorStore.segmentLoading);
const hasMatches = computed(() => Array.from(loaded.value.values()).some(entry => folderEntryMatches(entry, query.value)));
const filterNode = (value: string, data: Record<string, unknown>) => typeof data.name === 'string' && folderEntryMatches({ name: data.name }, value);

function collectExpanded() { return Array.from(loaded.value.keys()).filter(path => treeRef.value?.getNode(path)?.expanded); }
function remember(entries: FolderEntry[]) {
  const next = new Map(loaded.value);
  for (const entry of entries) next.set(entry.path, entry);
  loaded.value = next;
}
async function applyFilter() {
  const version = ++filterGeneration;
  await nextTick();
  if (!treeRef.value || version !== filterGeneration) return;
  if (query.value && expandedBeforeFilter === null) expandedBeforeFilter = collectExpanded();
  treeRef.value.filter(query.value);
  if (query.value) {
    for (const entry of loaded.value.values()) {
      if (!folderEntryMatches(entry, query.value)) continue;
      let parent = treeRef.value.getNode(entry.path)?.parent;
      while (parent && parent.level > 0) {
        // Only ancestors of already-loaded matches are disclosed. Never expand
        // an unloaded matching folder, which would silently turn filtering into scanning.
        if (parent.loaded) parent.expand();
        parent = parent.parent;
      }
    }
  }
  if (!query.value && expandedBeforeFilter !== null) {
    const keep = new Set(expandedBeforeFilter);
    for (const entry of loaded.value.values()) {
      if (!entry.dir) continue;
      const node = treeRef.value.getNode(entry.path);
      if (keep.has(entry.path)) node?.expand(); else node?.collapse();
    }
    expandedBeforeFilter = null;
  }
}
watch(filterText, value => { if (!composing.value) query.value = value.trim(); });
watch(query, () => { void applyFilter(); });
function compositionEnded() { composing.value = false; void nextTick(() => { query.value = filterText.value.trim(); }); }
function clearFilter() { filterText.value = ''; query.value = ''; searchInput.value?.focus(); }

watch(() => appStore.folder, () => {
  treeVersion.value += 1;
  pending.value = 0;
  loaded.value = new Map();
  failures.value = [];
  rootLoaded.value = false;
  rootCount.value = 0;
  expandedKeys.value = [];
  expandedBeforeFilter = null;
  cachedRoot = null;
  filterText.value = '';
  query.value = '';
  openFailure.value = null;
}, { flush: 'sync' });

async function directoryEntries(path: string): Promise<FolderEntry[]> {
  const response = await ls(path) as { code: number; data?: { children?: unknown }; info?: string };
  if (response.code !== 0 || !response.data) throw new Error('folder_read_failed');
  return normalizeFolderEntries(response.data.children, locale.value);
}
function failDirectory(path: string) {
  if (!failures.value.some(failure => failure.path === path)) failures.value.push({ path, name: folderLabel(path) });
}
const loadNode = async (node: Node, resolve: (entries: FolderEntry[]) => void) => {
  const root = appStore.folder;
  if (!root) return resolve([]);
  const path = node.level === 0 ? root : (node.data as FolderEntry).path;
  const version = treeVersion.value;
  pending.value += 1;
  try {
    const entries = node.level === 0 && cachedRoot ? cachedRoot : await directoryEntries(path);
    if (!alive || version !== treeVersion.value || root !== appStore.folder) return resolve([]);
    if (node.level === 0) { cachedRoot = null; rootCount.value = entries.length; rootLoaded.value = true; }
    remember(entries);
    resolve(entries);
    void applyFilter();
  } catch {
    if (alive && version === treeVersion.value && root === appStore.folder) {
      failDirectory(path);
      if (node.level === 0) rootLoaded.value = true;
      resolve([]);
    }
  } finally { if (alive && version === treeVersion.value) pending.value = Math.max(0, pending.value - 1); }
};

async function refreshFolder() {
  const root = appStore.folder;
  if (!root || pending.value || opening.value) return;
  const version = treeVersion.value;
  pending.value += 1;
  try {
    const entries = await directoryEntries(root);
    if (!alive || version !== treeVersion.value || root !== appStore.folder) return;
    expandedKeys.value = expandedBeforeFilter || collectExpanded();
    cachedRoot = entries;
    loaded.value = new Map();
    failures.value = [];
    rootCount.value = entries.length;
    rootLoaded.value = true;
    pending.value = 0;
    treeVersion.value += 1;
    expandedBeforeFilter = null;
  } catch { if (alive && version === treeVersion.value) failDirectory(root); }
  finally { if (alive && version === treeVersion.value) pending.value = Math.max(0, pending.value - 1); }
}
async function retryDirectory(path: string) {
  if (path === appStore.folder) return refreshFolder();
  if (pending.value) return;
  const version = treeVersion.value;
  pending.value += 1;
  try {
    const entries = await directoryEntries(path);
    if (!alive || version !== treeVersion.value) return;
    remember(entries);
    treeRef.value?.updateKeyChildren(path, entries);
    const node = treeRef.value?.getNode(path);
    if (node) { node.isLeaf = entries.length === 0; node.expand(); }
    failures.value = failures.value.filter(failure => failure.path !== path);
    void applyFilter();
  } catch { if (alive && version === treeVersion.value) failDirectory(path); }
  finally { if (alive && version === treeVersion.value) pending.value = Math.max(0, pending.value - 1); }
}
async function openFile(path: string) {
  if (opening.value || documentBusy.value) return;
  opening.value = true;
  openFailure.value = null;
  try { if (await appStore.openMarkdownDocument(path) === 'failed') openFailure.value = path; }
  catch { openFailure.value = path; }
  finally { opening.value = false; }
}
function nodeClick(entry: FolderEntry) { if (!entry.dir) void openFile(entry.path); }
onBeforeUnmount(() => { alive = false; });
</script>

<style lang="scss">
.folder-container {
  display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; min-width: 0;
  --el-fill-color-light: var(--primaryBackgroundColorHover);
  --el-fill-color-blank: var(--primaryBackgroundColor);
  --el-text-color-regular: var(--primaryTextColor);
  .folder-toolbar { flex: none; display: flex; align-items: center; gap: 4px; padding: 4px 6px 4px 0; }
  .folder-root { flex: 1; min-width: 0; font-size: 12px; overflow-wrap: anywhere; }
  button { border: 0; border-radius: 4px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
  button:hover { background: var(--primaryBackgroundColorHover); }
  button:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: -2px; }
  button:disabled { cursor: default; opacity: .55; }
  .folder-toolbar button, .folder-clear { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; flex: none; }
  .folder-search { flex: none; padding-right: 6px; .el-input__wrapper { box-shadow: none; } }
  .folder-filter-hint { flex: none; margin: 4px 6px 6px 0; font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
  .folder-scrollbar { flex: 1; min-height: 0; .el-scrollbar__view { min-height: 100%; } }
  .folder-empty { margin: 8px 6px 8px 0; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; p { margin: 0 0 8px; } button { border: 1px solid var(--primaryBorderColor); padding: 4px 8px; } }
  .folder-error { flex: none; margin: 4px 6px 6px 0; padding: 6px; border: 1px solid var(--primaryBorderColor); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; button { text-decoration: underline; padding: 2px 4px; } }
  .el-tree { --el-fill-color-light: var(--primaryBackgroundColor); --el-tree-text-color: var(--primaryTextColor); --el-tree-node-hover-bg-color: var(--primaryBackgroundColorHover); background: transparent; }
  .el-tree-node:focus-visible > .el-tree-node__content { outline: 2px solid var(--primaryBorderColor); outline-offset: -2px; }
  .folder-tree-node { display: flex; align-items: center; min-width: 0; .file-type-dir { color: var(--primaryTextColorHover); } .file-type-icon { display: inline-flex; flex: none; align-items: center; margin-right: 4px; } .img-icon { width: 16px; height: 16px; } }
  .folder-node-name { overflow-wrap: anywhere; white-space: normal; }
  .el-tree-node__content { min-height: 26px; height: auto; }
}
@media (prefers-reduced-motion: reduce) { .folder-container .el-collapse-transition { transition: none !important; } }
</style>
