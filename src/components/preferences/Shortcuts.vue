<template>
  <form class="preferences-shortcuts" novalidate data-shortcut-capture :aria-busy="busy" @submit.prevent="saveShortcuts">
    <div class="shortcut-toolbar">
      <ElButton type="primary" native-type="submit" :disabled="!canSave">{{ t('shortcutSave') }}</ElButton>
      <ElButton :disabled="busy || !preferencesStore.shortcutsLoaded" @click="restoreDefaults">{{ t('shortcutRestoreDefaults') }}</ElButton>
    </div>
    <p id="shortcut-hint" class="shortcut-hint">{{ t('shortcutHint') }}</p>
    <div class="shortcut-status" aria-live="polite">
      <span v-if="preferencesStore.loadingShortcuts">{{ t('shortcutLoading') }}</span>
      <span v-else-if="preferencesStore.savingShortcuts">{{ t('savingPreferences') }}</span>
      <div v-else-if="preferencesStore.shortcutLoadError" class="shortcut-error" role="alert">
        <span>{{ t('shortcutLoadFailed') }}</span>
        <ElButton size="small" @click="loadShortcuts">{{ t('retry') }}</ElButton>
      </div>
      <div v-else-if="preferencesStore.shortcutSaveError || preferencesStore.shortcutSyncError" class="shortcut-error" :class="{ 'shortcut-sync-error': !preferencesStore.shortcutSaveError }" role="alert">
        <span>{{ t(preferencesStore.shortcutSaveError ? 'shortcutSaveFailed' : 'shortcutSyncFailed') }}</span>
        <ElButton size="small" @click="saveShortcuts">{{ t('retry') }}</ElButton>
      </div>
      <span v-else-if="hasErrors">{{ t('shortcutFixErrors') }}</span>
      <span v-else-if="dirty">{{ t('shortcutUnsavedStatus') }}</span>
      <span v-else-if="saved">{{ t('preferencesSaved') }}</span>
    </div>
    <fieldset :disabled="busy || !preferencesStore.shortcutsLoaded" class="shortcut-fields">
      <section v-for="group in groups" :key="group.id" class="preferences-item" :aria-label="t(group.id)">
        <div class="header">{{ t(group.id) }}</div>
        <div class="content">
          <div v-for="definition in group.items" :key="definition.id" :data-shortcut-id="definition.id" class="shortcut-row">
            <label :for="inputId(definition.id)" class="shortcut-label">{{ actionLabel(definition.id) }}</label>
            <div class="shortcut-control">
              <ElInput :id="inputId(definition.id)" class="shortcut-input" readonly :model-value="displayShortcut(draft[definition.id])"
                :placeholder="t(recording === definition.id ? 'shortcutRecording' : 'shortcutUnassigned')"
                v-shortcut-a11y="{ label: actionLabel(definition.id), error: Boolean(errors[definition.id]), description: descriptionIds(definition.id) }"
                @focus="startRecording(definition.id)" @blur="recording = null" @keydown="event => recordShortcut(event, definition.id)" />
              <ElButton size="small" :aria-label="t('shortcutClearAction', { action: actionLabel(definition.id) })" :disabled="!draft[definition.id]" @click="setShortcut(definition.id, '')">{{ t('shortcutClear') }}</ElButton>
              <ElButton size="small" :aria-label="t('shortcutResetAction', { action: actionLabel(definition.id) })"
                :disabled="draft[definition.id] === definition.defaultKey && !captureErrors[definition.id]" @click="setShortcut(definition.id, definition.defaultKey)">{{ t('shortcutReset') }}</ElButton>
            </div>
            <p :id="`${inputId(definition.id)}-default`" class="shortcut-default">{{ t('shortcutDefault', { key: displayShortcut(definition.defaultKey) || t('shortcutUnassigned') }) }}</p>
            <p v-if="errors[definition.id]" :id="`${inputId(definition.id)}-error`" class="shortcut-field-error" role="alert">{{ fieldError(definition.id) }}</p>
          </div>
        </div>
      </section>
    </fieldset>
    <div class="shortcut-footer">
      <ElButton type="primary" :disabled="!canSave" @click="saveShortcuts">{{ t('shortcutSave') }}</ElButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Directive } from 'vue';
import { ElButton, ElInput, ElMessageBox } from 'element-plus';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '../../store/app';
import { usePreferencesStore } from '../../store/preferences';
import { DEFAULT_SHORTCUT_PREFERENCES, SHORTCUT_DEFINITIONS, shortcutFromKeyboardEvent, validateShortcutPreferences } from '../../utils/shortcutPreferences';

const { t } = useI18n();
const emit = defineEmits<{ (event: 'reveal'): void }>();
const appStore = useAppStore();
const preferencesStore = usePreferencesStore();
const draft = ref({ ...preferencesStore.shortcuts });
const baseline = ref({ ...preferencesStore.shortcuts });
const recording = ref<string | null>(null);
const recordingBefore = ref('');
const captureErrors = ref<Record<string, { type: 'invalid' }>>({});
const saved = ref(false);
const groups = ['file', 'edit', 'format', 'paragraph', 'view'].map(id => ({ id, items: SHORTCUT_DEFINITIONS.filter(item => item.description[0] === id) }));
const busy = computed(() => preferencesStore.loadingShortcuts || preferencesStore.savingShortcuts);
const dirty = computed(() => SHORTCUT_DEFINITIONS.some(item => draft.value[item.id] !== baseline.value[item.id]));
const errors = computed(() => ({ ...validateShortcutPreferences(draft.value, appStore.platform), ...captureErrors.value }));
const hasErrors = computed(() => Object.keys(errors.value).length > 0);
const canSave = computed(() => !busy.value && preferencesStore.shortcutsLoaded && (dirty.value || Boolean(preferencesStore.shortcutSaveError || preferencesStore.shortcutSyncError)));

watch(() => preferencesStore.shortcuts, value => {
  if (!dirty.value) {
    draft.value = { ...value };
    baseline.value = { ...value };
  }
}, { deep: true });

function inputId(id: string) { return `shortcut-${id.replace(/\./g, '-')}`; }
function actionLabel(id: string): string {
  const action = id.split('.').pop() || id;
  const heading = /^heading([1-6])$/.exec(action);
  return heading ? `${t('heading')} ${heading[1]}` : t(action);
}
function displayShortcut(value = '') {
  return value.replace(/Mod/g, appStore.platform === 'macos' ? 'Cmd' : 'Ctrl').replace(/Meta/g, appStore.platform === 'macos' ? 'Cmd' : 'Win').replace(/Alt/g, appStore.platform === 'macos' ? 'Option' : 'Alt');
}
function descriptionIds(id: string) {
  return `shortcut-hint ${inputId(id)}-default${errors.value[id] ? ` ${inputId(id)}-error` : ''}`;
}
function fieldError(id: string) {
  const error = errors.value[id];
  return error?.type === 'conflict' ? t('shortcutConflict', { action: actionLabel(error.conflictWith || '') }) : t('shortcutInvalid');
}
// Forward field semantics to the actual input in the maintained Element Plus primitive.
const describeInput = (element: HTMLElement, value: { label: string; error: boolean; description: string }) => {
  const input = element.querySelector('input');
  input?.setAttribute('aria-label', value.label);
  input?.setAttribute('aria-invalid', String(value.error));
  input?.setAttribute('aria-describedby', value.description);
};
const vShortcutA11y: Directive<HTMLElement, { label: string; error: boolean; description: string }> = {
  mounted: (element, binding) => describeInput(element, binding.value),
  updated: (element, binding) => describeInput(element, binding.value),
};
function startRecording(id: string) {
  recording.value = id;
  recordingBefore.value = draft.value[id];
}
function setShortcut(id: string, value: string) {
  draft.value[id] = value;
  delete captureErrors.value[id];
  saved.value = false;
}
function recordShortcut(inputEvent: Event, id: string) {
  const event = inputEvent as KeyboardEvent;
  if (busy.value || event.isComposing || event.keyCode === 229 || event.repeat) return;
  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    setShortcut(id, recordingBefore.value);
    (event.target as HTMLInputElement).blur();
    return;
  }
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) return;
  if (['Backspace', 'Delete'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    setShortcut(id, '');
    return;
  }
  const shortcut = shortcutFromKeyboardEvent(event, appStore.platform);
  if (!shortcut) captureErrors.value[id] = { type: 'invalid' };
  else setShortcut(id, shortcut);
}
function restoreDefaults() {
  draft.value = { ...DEFAULT_SHORTCUT_PREFERENCES };
  captureErrors.value = {};
  saved.value = false;
}
async function loadShortcuts() {
  try { await preferencesStore.loadShortcutPreferences(); } catch { /* The store retains a recoverable loading error. */ }
}
async function saveShortcuts(): Promise<boolean> {
  if (busy.value || !preferencesStore.shortcutsLoaded) return false;
  saved.value = false;
  if (hasErrors.value) {
    await nextTick();
    document.getElementById(inputId(Object.keys(errors.value)[0]))?.focus();
    return false;
  }
  try {
    await preferencesStore.saveShortcutPreferences({ ...draft.value }, appStore.platform);
    draft.value = { ...preferencesStore.shortcuts };
    baseline.value = { ...preferencesStore.shortcuts };
    saved.value = true;
    return true;
  } catch { return false; }
}

let unlistenClose: (() => void) | undefined;
let disposed = false;
let closing = false;
let closePrompt = false;
onMounted(async () => {
  void loadShortcuts();
  const appWindow = getCurrentWindow();
  const unlisten = await appWindow.onCloseRequested(async event => {
    if (closing || (!dirty.value && !preferencesStore.savingShortcuts)) return;
    event.preventDefault();
    if (closePrompt || preferencesStore.savingShortcuts) return;
    closePrompt = true;
    try {
      await ElMessageBox.confirm(t('shortcutUnsavedClose'), t('shortcuts'), {
        confirmButtonText: t('shortcutSave'), cancelButtonText: t('shortcutDiscard'), distinguishCancelAndClose: true,
        closeOnClickModal: false,
      });
      emit('reveal');
      await nextTick();
      if (!await saveShortcuts()) return;
    } catch (action) {
      if (action !== 'cancel') return;
    } finally { closePrompt = false; }
    closing = true;
    await appWindow.close();
  });
  if (disposed) unlisten();
  else unlistenClose = unlisten;
});
onBeforeUnmount(() => { disposed = true; unlistenClose?.(); });
</script>

<style lang="scss">
.preferences-shortcuts {
  padding: 12px 0;
  .shortcut-toolbar, .shortcut-footer { display: flex; flex-wrap: wrap; gap: 8px; }
  .el-button + .el-button { margin-left: 0; }
  .shortcut-hint { margin: 12px 0 8px; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
  .shortcut-status { min-height: 40px; font-size: 12px; line-height: 1.5; }
  .shortcut-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
  .shortcut-fields { margin: 0; padding: 0; border: 0; min-width: 0; }
  .shortcut-row { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(230px, 2fr); column-gap: 12px; padding: 8px 0; align-items: center; }
  .shortcut-label { font-size: 14px; overflow-wrap: anywhere; }
  .shortcut-control { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .shortcut-input { flex: 1; min-width: 0; }
  .shortcut-input .el-input__inner { font-family: ui-monospace, monospace; cursor: pointer; }
  .shortcut-input:focus-within .el-input__wrapper { box-shadow: 0 0 0 2px var(--primaryBorderColor); }
  .shortcut-input:has([aria-invalid="true"]) .el-input__wrapper { box-shadow: 0 0 0 1px var(--el-color-danger); }
  .shortcut-default, .shortcut-field-error { grid-column: 2; margin: 4px 0 0; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
  .shortcut-field-error { color: var(--el-color-danger); }
  .shortcut-footer { padding: 12px 4px; }
}
@media (max-width: 760px) {
  .preferences-shortcuts .shortcut-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .preferences-shortcuts .shortcut-default, .preferences-shortcuts .shortcut-field-error { grid-column: 1; }
}
</style>
