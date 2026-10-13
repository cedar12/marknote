<template>
  <section class="preferences-item editor-mode-settings" :aria-label="t('editorMode')" :aria-busy="preferences.savingEditorMode">
    <div class="header"><label for="editor-mode-preference">{{ t('editorMode') }}</label></div>
    <div class="content">
      <ElSelect id="editor-mode-preference" v-model="modeDraft" :disabled="preferences.savingEditorMode"
        v-control-a11y="{ id: 'editor-mode-preference', label: t('editorMode'), describedBy: 'editor-mode-hint' }"
        @change="save">
        <ElOption :label="t('editorModeRendered')" value="wysiwyg" />
        <ElOption :label="t('editorModeSource')" value="source" />
        <ElOption :label="t('editorModeSplit')" value="split" />
      </ElSelect>
      <p id="editor-mode-hint" class="editor-mode-hint">{{ t('editorModePreferenceHint') }}</p>
      <div class="editor-mode-status" aria-live="polite">
        <span v-if="preferences.savingEditorMode">{{ t('savingPreferences') }}</span>
        <div v-else-if="preferences.editorModeSaveError || preferences.editorModeSyncError" role="alert" class="editor-mode-error">
          <span>{{ t(preferences.editorModeSaveError ? 'editorModeSaveFailed' : 'editorModeSyncFailed') }}</span>
          <ElButton size="small" @click="save(failedMode || preferences.editorMode)">{{ t('retry') }}</ElButton>
        </div>
        <span v-else-if="saved">{{ t('preferencesSaved') }}</span>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { ElSelect, ElOption, ElButton } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { usePreferencesStore } from '../../store/preferences';
import { vControlA11y } from '../../directives/controlA11y';
import type { SourceMode } from '../../utils/sourceDocument';
const preferences = usePreferencesStore(), { t } = useI18n();
const saved = ref(false), failedMode = ref<SourceMode | null>(null);
const modeDraft = ref<SourceMode>(preferences.editorMode);
watch(() => preferences.editorMode, mode => { modeDraft.value = mode; });
async function save(mode: SourceMode) {
  if (preferences.savingEditorMode) return;
  saved.value = false;
  failedMode.value = mode;
  try {
    await preferences.saveEditorMode(mode);
    saved.value = true;
    if (!preferences.editorModeSyncError) failedMode.value = null;
  } catch {
    await nextTick();
    modeDraft.value = preferences.editorMode;
  }
}
</script>
<style scoped lang="scss">
.editor-mode-hint { margin:8px 0; font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
.editor-mode-status { min-height:24px; margin-top:8px; font-size:12px; line-height:1.5; }
.editor-mode-error { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.editor-mode-settings label { cursor:pointer; }
</style>
