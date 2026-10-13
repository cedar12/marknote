<template>
  <nav class="source-mode-bar" :aria-label="t('editorMode')">
    <div class="source-mode-choices" role="group" :aria-label="t('editorMode')">
      <button v-for="mode in modes" :key="mode.value" type="button" :aria-pressed="store.sourceMode === mode.value" :disabled="blocked" @click="store.setSourceMode(mode.value)">{{ t(mode.key) }}</button>
    </div>
    <span v-if="store.sourceSwitching" class="source-mode-status" role="status">{{ t('sourceSwitchPending') }}</span>
    <span v-else-if="store.sourceSwitchError" class="source-mode-error" role="alert">{{ t('sourceSwitchFailed') }} <button type="button" :disabled="blocked" @click="store.setSourceMode('wysiwyg')">{{ t('retry') }}</button></span>
  </nav>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useEditorStore } from '../../store/editor';
import { useAppStore } from '../../store/app';
import type { SourceMode } from '../../utils/sourceDocument';
const store = useEditorStore(), app = useAppStore(), { t } = useI18n();
const modes: { value: SourceMode; key: string }[] = [{ value: 'wysiwyg', key: 'editorModeRendered' }, { value: 'source', key: 'editorModeSource' }, { value: 'split', key: 'editorModeSplit' }];
const blocked = computed(() => app.lifecycleBusy || app.saving || app.exporting || app.loading || app.resourceTasks > 0 || store.loading || store.renderingDocument || store.segmentLoading || store.sourceComposing);
</script>
<style scoped lang="scss">
.source-mode-bar { position:sticky;top:0;z-index:4;display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:36px;padding:4px 12px;box-sizing:border-box;background:var(--contentBackgroundColor);color:var(--contentTextColor);border-bottom:1px solid var(--contentBorderColor); }
.source-mode-choices { display:flex;flex-wrap:wrap;gap:3px;min-width:0; }
button { font:inherit;font-size:12px;min-height:26px;padding:2px 9px;border:1px solid var(--contentBorderColor);border-radius:4px;color:var(--contentTextColor);background:var(--contentBackgroundColor);cursor:pointer;
  &:hover:not(:disabled) { background:var(--contentBackgroundColorHover); }
  &:active:not(:disabled),&[aria-pressed="true"] { background:var(--contentBackgroundColorActive); }
  &:focus-visible { outline:2px solid var(--primaryTextColor);outline-offset:1px; }
  &:disabled { opacity:.5;cursor:default; }
}
.source-mode-status,.source-mode-error { font-size:12px;overflow-wrap:anywhere; }
</style>
