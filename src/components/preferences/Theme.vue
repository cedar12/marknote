<template>
  <section ref="sectionRef" class="preferences-theme" :aria-label="t('theme')" :aria-busy="busy">
    <div class="theme-header">
      <h2>{{ t('theme') }}</h2>
      <div class="theme-toolbar">
        <ElButton size="small" :disabled="busy" :loading="pending === 'install'" @click="install">{{ t('installThemeFile') }}</ElButton>
        <ElButton size="small" :icon="Refresh" :disabled="busy" :loading="pending === 'refresh'" @click="refresh">{{ t('refreshThemes') }}</ElButton>
      </div>
    </div>
    <p class="theme-help">{{ t('themeFileHint') }}</p>
    <div class="theme-status" role="status">{{ status }}</div>
    <div v-if="error" class="theme-error" role="alert">
      <span>{{ error }}</span>
      <ElButton v-if="loadFailed" size="small" :disabled="busy" @click="refresh">{{ t('retry') }}</ElButton>
    </div>
    <ul class="theme-list">
      <li v-for="theme in themes" :key="theme.value" class="theme-item">
        <button type="button" class="theme-select" :class="{ active: appStore.theme?.value === theme.value }" :aria-pressed="appStore.theme?.value === theme.value" :aria-label="t('applyTheme', { theme: themeLabel(theme) })" :disabled="busy" @click="selectTheme(theme)">
          <div class="theme-option" :style="caseStyle(theme)">
            <h3>{{ themeLabel(theme) }}</h3>
            <p>{{ t('themePreview') }}</p>
            <code>const note = 'Markdown';</code>
          </div>
          <span class="theme-meta">
            <span>{{ t(isBuiltInTheme(theme.value) ? 'themeBuiltin' : theme.source === 'installed' ? 'themeInstalled' : 'themeBundled') }}</span>
            <span v-if="appStore.theme?.value === theme.value" class="theme-current"><FullSelection aria-hidden="true" /> {{ t('currentTheme') }}</span>
          </span>
        </button>
        <div class="theme-item-actions">
          <ElButton v-if="theme.removable" size="small" type="danger" plain :disabled="busy" :loading="pending === `uninstall:${theme.value}`" :aria-label="t('uninstallNamedTheme', { theme: themeLabel(theme) })" @click="uninstall(theme)">{{ t('uninstallTheme') }}</ElButton>
        </div>
      </li>
    </ul>
    <div class="preferences-item flat theme-auto">
      <label for="auto-theme">{{ t('autoTheme') }}</label>
      <ElSwitch id="auto-theme" :model-value="appStore.autoTheme" :aria-label="t('autoTheme')" :disabled="busy" @change="changeAutoTheme" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { ElButton, ElSwitch } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { open, confirm } from '@tauri-apps/plugin-dialog';
import { emit } from '@tauri-apps/api/event';
import { FullSelection, Refresh } from '@icon-park/vue-next';
import { useAppStore } from '../../store/app';
import themes, { applyThemeCatalog, findThemeByType, isBuiltInTheme, refreshThemeCatalog, setTheme, THEME_STYLE_KEYS, type ThemeItem } from '../../theme';
import { installTheme, uninstallTheme, type ThemeEntry } from '../../api/theme';

const { t } = useI18n();
const appStore = useAppStore();
const sectionRef = ref<HTMLElement | null>(null);
const pending = ref<string | null>(null);
const error = ref('');
const status = ref('');
const loadFailed = ref(false);
const busy = computed(() => pending.value !== null);
const themeLabel = (theme: ThemeItem) => isBuiltInTheme(theme.value) ? t(theme.value === 'light' ? 'themeLight' : 'themeDark') : theme.label;
const caseStyle = (theme: ThemeItem) => Object.fromEntries(THEME_STYLE_KEYS.map(key => [`--${key}`, theme.style[key]]));

function showError(reason: unknown) {
  const code = reason && typeof reason === 'object' && 'code' in reason ? String(reason.code) : '';
  const messages: Record<string, string> = {
    invalid_theme: 'themeInvalidFile', duplicate_theme: 'themeDuplicate', builtin_theme: 'themeProtected',
    theme_not_found: 'themeNotFound', io_error: 'themeFileFailed', path_error: 'themeFileFailed',
  };
  error.value = t(messages[code] || 'themeOperationFailed');
}

async function publishCatalog() {
  try { await emit('themeCatalogChanged', themes.filter(theme => !isBuiltInTheme(theme.value)).map(theme => ({ ...theme }))); }
  catch { error.value = t('themeSyncFailed'); }
}

async function apply(theme: ThemeItem) {
  appStore.theme = theme;
  setTheme(theme);
  try { await emit('theme', theme); } catch { error.value = t('themeSyncFailed'); }
}

async function refresh() {
  if (busy.value) return;
  pending.value = 'refresh';
  error.value = '';
  status.value = '';
  try {
    await refreshThemeCatalog();
    loadFailed.value = false;
    appStore.syncThemeWithCatalog();
    await publishCatalog();
    status.value = t('themesRefreshed');
  } catch (reason) { loadFailed.value = true; showError(reason); }
  finally { pending.value = null; }
}
onMounted(refresh);

async function refreshAfterMutation() {
  try {
    await refreshThemeCatalog();
    loadFailed.value = false;
  } catch {
    loadFailed.value = true;
    error.value = t('themeRefreshFailed');
  }
  appStore.syncThemeWithCatalog();
  await publishCatalog();
}

async function selectTheme(theme: ThemeEntry) {
  if (busy.value) return;
  pending.value = 'select';
  error.value = '';
  try { await apply(theme); status.value = t('themeApplied', { theme: themeLabel(theme) }); }
  finally { pending.value = null; }
}

async function install() {
  if (busy.value) return;
  pending.value = 'install';
  error.value = '';
  status.value = '';
  try {
    const path = await open({ title: t('installThemeFile'), multiple: false, directory: false, filters: [{ name: t('themeFileType'), extensions: ['json'] }] });
    if (!path || Array.isArray(path)) return;
    const installed = await installTheme(path);
    applyThemeCatalog([...themes.filter(theme => !isBuiltInTheme(theme.value)), { ...installed, source: 'installed', removable: true }]);
    await refreshAfterMutation();
    status.value = t('themeInstalledSuccess', { theme: themeLabel(installed) });
  } catch (reason) { showError(reason); }
  finally { pending.value = null; }
}

async function uninstall(theme: ThemeEntry) {
  if (busy.value || !theme.removable || isBuiltInTheme(theme.value)) return;
  pending.value = `uninstall:${theme.value}`;
  error.value = '';
  status.value = '';
  try {
    const accepted = await confirm(t('themeUninstallConfirm', { theme: themeLabel(theme) }), {
      title: t('uninstallTheme'), kind: 'warning', okLabel: t('uninstallTheme'), cancelLabel: t('cancel'),
    });
    if (!accepted) return;
    await uninstallTheme(theme.value);
    applyThemeCatalog(themes.filter(entry => !isBuiltInTheme(entry.value) && entry.value !== theme.value));
    if (appStore.theme?.value === theme.value) await apply(findThemeByType(theme.type)!);
    await refreshAfterMutation();
    status.value = t('themeUninstalledSuccess', { theme: themeLabel(theme) });
  } catch (reason) { showError(reason); }
  finally {
    pending.value = null;
    await nextTick();
    if (!themes.some(entry => entry.value === theme.value)) sectionRef.value?.querySelector<HTMLButtonElement>('.theme-select.active')?.focus();
  }
}

async function changeAutoTheme(value: boolean | string | number) {
  if (busy.value) return;
  pending.value = 'auto';
  error.value = '';
  appStore.autoTheme = Boolean(value);
  localStorage.setItem('autoTheme', String(appStore.autoTheme));
  if (appStore.autoTheme) await apply(findThemeByType(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')!);
  try { await emit('autoTheme', appStore.autoTheme); } catch { error.value = t('themeSyncFailed'); }
  finally { pending.value = null; }
}
</script>

<style lang="scss">
.preferences-theme {
  padding-bottom: 20px;
  .theme-header { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 12px; margin: 18px 0 10px; }
  h2 { font-size: 20px; margin: 0; }
  .theme-toolbar { display: flex; gap: 8px; flex-wrap: wrap; .el-button + .el-button { margin-left: 0; } }
  .theme-help { margin: 0; font-size: 12px; line-height: 1.6; }
  .theme-status, .theme-error { overflow-wrap: anywhere; }
  .theme-status { min-height: 20px; margin: 8px 0; font-size: 12px; }
  .theme-error { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 12px; margin-bottom: 12px; }
  .theme-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 12px; }
  .theme-item { min-width: 0; }
  .theme-select {
    display: block; width: 100%; padding: 0; text-align: left; border: 1px solid var(--contentBorderColor); border-radius: 4px; overflow: hidden; background: var(--contentBackgroundColor); color: var(--contentTextColor); font: inherit; cursor: pointer;
    &:hover:not(:disabled), &.active { border-color: var(--primaryTextColorActive); }
    &:active:not(:disabled) { border-color: var(--primaryBorderColor); }
    &:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
    &:disabled { cursor: default; opacity: .65; }
  }
  .theme-option { padding: 16px; background: var(--contentBackgroundColor); color: var(--contentTextColor); min-height: 115px; box-sizing: border-box; overflow-wrap: anywhere; }
  .theme-option h3 { margin: 0 0 8px; font-size: 18px; }
  .theme-option p { margin: 0 0 8px; font-size: 12px; line-height: 1.5; }
  .theme-option code { font-size: 11px; padding: 2px 4px; background: var(--contentBackgroundColorActive); }
  .theme-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; padding: 8px; font-size: 12px; }
  .theme-current { display: inline-flex; align-items: center; gap: 4px; }
  .theme-item-actions { min-height: 30px; padding-top: 6px; display: flex; justify-content: flex-end; }
  .theme-auto { margin-top: 16px; gap: 16px; font-size: 14px; .el-switch { flex: none; } }
}
</style>
