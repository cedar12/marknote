<template>
  <div class="preferences-editor">
    <section class="preferences-item editor-font-settings" :aria-label="t('editorFont')" :aria-busy="preferencesStore.savingEditorFont">
      <div class="header"><span>{{ t('editorFont') }}</span></div>
      <div class="content">
        <div class="editor-font-fields">
          <label for="editor-font-family">{{ t('fontFamily') }}</label>
          <ElSelect id="editor-font-family" :model-value="preferencesStore.editorFont.fontFamily" filterable allow-create default-first-option
            :disabled="preferencesStore.savingEditorFont" :aria-label="t('fontFamily')" v-font-hint="{ label: t('fontFamily'), hint: 'editor-font-hint' }"
            @change="value => saveFont({ fontFamily: value })">
            <ElOption v-for="family in EDITOR_FONT_PRESETS" :key="family" :label="t(fontLabels[family])" :value="family" />
            <ElOption v-if="customFont" :key="customFont" :label="customFont" :value="customFont" />
          </ElSelect>
          <label for="editor-font-size">{{ t('fontSize') }}</label>
          <ElInputNumber id="editor-font-size" v-model="fontSizeDraft" :value-on-clear="preferencesStore.editorFont.fontSize" :min="MIN_EDITOR_FONT_SIZE" :max="MAX_EDITOR_FONT_SIZE" :step="1" :precision="0" controls-position="right"
            :disabled="preferencesStore.savingEditorFont" v-font-hint="{ label: t('fontSize'), hint: 'editor-font-size-hint' }"
            @change="onFontSizeChange" />
        </div>
        <p id="editor-font-hint" class="editor-font-hint">{{ t('fontFamilyHint') }}</p>
        <p id="editor-font-size-hint" class="editor-font-hint">{{ t('fontSizeHint', { min: MIN_EDITOR_FONT_SIZE, max: MAX_EDITOR_FONT_SIZE }) }}</p>
        <div class="editor-font-preview" :aria-label="t('editorFontPreview')">{{ t('editorFontSample') }}</div>
        <ElButton :disabled="preferencesStore.savingEditorFont" @click="saveFont({ ...DEFAULT_EDITOR_FONT })">{{ t('restoreEditorFontDefaults') }}</ElButton>
        <div class="editor-font-status" aria-live="polite">
          <span v-if="preferencesStore.savingEditorFont">{{ t('savingPreferences') }}</span>
          <div v-else-if="preferencesStore.editorFontSaveError || preferencesStore.editorFontSyncError" class="editor-font-error" role="alert">
            <span>{{ t(preferencesStore.editorFontSaveError === 'invalid' ? 'editorFontInvalid' : preferencesStore.editorFontSaveError ? 'editorFontSaveFailed' : 'editorFontSyncFailed') }}</span>
            <ElButton v-if="preferencesStore.editorFontSaveError !== 'invalid'" size="small" @click="saveFont(failedFontPatch || {})">{{ t('retry') }}</ElButton>
          </div>
          <span v-else-if="fontSaved">{{ t('preferencesSaved') }}</span>
        </div>
      </div>
    </section>
    <div class="preferences-item">
      <div class="header flex"><span>{{ t('codeTheme') }}</span></div>
      <div class="content">
        <ElSelect v-model="editorStore.codeTheme" :aria-label="t('codeTheme')" @change="onChange">
          <ElOption v-for="item in options" :key="item" :label="item" :value="item" />
        </ElSelect>
      </div>
    </div>
    <div class="preferences-item">
      <div class="header"><span>{{ t('tabSize') }}</span></div>
      <div class="content">
        <ElSelect v-model="preferencesStore.editor.tabSize" :aria-label="t('tabSize')" @change="onChangeTabSize">
          <ElOption label="2" :value="2" />
          <ElOption label="4" :value="4" />
        </ElSelect>
      </div>
    </div>
    <div class="preferences-item">
      <div class="header"><span>{{ t('segmentNavigationMode') }}</span></div>
      <div class="content">
        <ElSelect v-model="preferencesStore.editor.segmentNavigationMode" :aria-label="t('segmentNavigationMode')" @change="onChangeSegmentNavigationMode">
          <ElOption :label="t('segmentNavigationButtons')" value="buttons" />
          <ElOption :label="t('segmentNavigationScroll')" value="scroll" />
        </ElSelect>
        <div class="segment-navigation-tip">{{ t('segmentNavigationHint') }}</div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, nextTick, ref, watch, type Directive } from 'vue';
import { useAppStore } from '../../store/app';
import { useEditorStore } from '../../store/editor';
import { usePreferencesStore, type SegmentNavigationMode, type EditorFontPreferences } from '../../store/preferences';
import { DEFAULT_EDITOR_FONT, EDITOR_FONT_PRESETS, MIN_EDITOR_FONT_SIZE, MAX_EDITOR_FONT_SIZE } from '../../utils/editorFont';
import { useI18n } from 'vue-i18n';
import { ElButton, ElInputNumber, ElSelect, ElOption } from 'element-plus';

const appStore = useAppStore();
const preferencesStore = usePreferencesStore();
const editorStore = useEditorStore();
const { t } = useI18n();
const fontSaved = ref(false);
const fontSizeDraft = ref<number | undefined>(preferencesStore.editorFont.fontSize);
watch(() => preferencesStore.editorFont.fontSize, size => { fontSizeDraft.value = size; });
const failedFontPatch = ref<Partial<EditorFontPreferences> | null>(null);
const fontLabels = { system: 'fontSystem', 'sans-serif': 'fontSansSerif', serif: 'fontSerif', monospace: 'fontMonospace' };
const customFont = computed(() => EDITOR_FONT_PRESETS.some(family => family === preferencesStore.editorFont.fontFamily) ? null : preferencesStore.editorFont.fontFamily);
// Element Plus 2.3 does not forward every ARIA attribute to its internal input.
const describeFontInput = (element: HTMLElement, value: { label: string; hint: string }) => {
  const input = element.querySelector('input');
  input?.setAttribute('aria-label', value.label);
  input?.setAttribute('aria-describedby', value.hint);
};
const vFontHint: Directive<HTMLElement, { label: string; hint: string }> = {
  mounted: (element, binding) => describeFontInput(element, binding.value),
  updated: (element, binding) => describeFontInput(element, binding.value),
};

async function saveFont(patch: Partial<EditorFontPreferences>) {
  if (preferencesStore.savingEditorFont) return;
  fontSaved.value = false;
  failedFontPatch.value = patch;
  try {
    await preferencesStore.saveEditorFont(patch);
    fontSaved.value = true;
    if (!preferencesStore.editorFontSyncError) failedFontPatch.value = null;
  } catch {
    // Flush the draft first so Element Plus observes the rollback without replacing the focused input.
    await nextTick();
    fontSizeDraft.value = preferencesStore.editorFont.fontSize;
  }
}

async function onFontSizeChange(value: number | undefined | null) {
  if (value == null) {
    await nextTick();
    fontSizeDraft.value = preferencesStore.editorFont.fontSize;
    return;
  }
  await saveFont({ fontSize: value });
}

const options = ['github', 'github-dark', 'idea', 'intellij-light', 'vs', 'xcode', 'googlecode', 'atom-one-dark', 'atom-one-light', 'codepen-embed', 'nnfx-dark', 'nnfx-light'];
const onChange = (value: string) => {
  localStorage.setItem('codeTheme', value);
  appStore.emit('codeTheme', value);
};
const onChangeTabSize = () => {
  appStore.emit('tabSize', preferencesStore.editor.tabSize);
};
const onChangeSegmentNavigationMode = (mode: SegmentNavigationMode) => {
  preferencesStore.setSegmentNavigationMode(mode);
  appStore.emit('segmentNavigationMode', mode);
};
</script>
<style lang="scss">
.preferences-editor {
  .segment-navigation-tip, .editor-font-hint {
    color: var(--contentTextColor);
    font-size: 12px;
    line-height: 1.5;
  }
  .segment-navigation-tip { padding-top: 8px; }
  .editor-font-fields { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; padding-top: 8px; }
  .editor-font-fields label { font-size: 14px; }
  .editor-font-fields .el-input-number { width: 160px; max-width: 100%; }
  .editor-font-hint { margin: 8px 0; overflow-wrap: anywhere; }
  .editor-font-preview {
    margin: 12px 0;
    padding: 12px;
    border: 1px solid var(--contentBorderColor);
    border-radius: 4px;
    font-family: var(--editorFontFamily, var(--fontFamily));
    font-size: var(--editorFontSize, 16px);
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .editor-font-status { min-height: 24px; margin-top: 8px; font-size: 12px; line-height: 1.5; }
  .editor-font-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
}
</style>