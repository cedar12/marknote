<template>
  <section class="preferences-image" :aria-label="t('image')" :aria-busy="preferences.busy">
    <form novalidate @submit.prevent="save" @compositionstart="composing = true" @compositionend="composing = false" @keydown.enter="event => { if (event.isComposing || composing) event.preventDefault(); }">
      <div class="image-preferences-status" aria-live="polite">
        <span v-if="preferences.loading">{{ t('loadingPreferences') }}</span>
        <span v-else-if="preferences.choosing">{{ t('choosingImageFolder') }}</span>
        <span v-else-if="preferences.saving">{{ t('savingPreferences') }}</span>
        <span v-else-if="preferences.saved">{{ t('preferencesSaved') }}</span>
      </div>
      <div class="preferences-item">
        <div class="header"><label for="image-save-type">{{ t('saveImageType') }}</label></div>
        <div class="content">
          <ElSelect id="image-save-type" :model-value="preferences.saveType" :disabled="disabled" v-control-a11y="{ id: 'image-save-type', label: t('saveImageType'), describedBy: 'image-save-type-hint' }" @change="preferences.changeType">
            <ElOption :label="t('default')" value="default" />
            <ElOption :label="t('sepc')" value="sepc" />
            <ElOption label="PicGo" value="picgo" />
          </ElSelect>
          <p id="image-save-type-hint" class="image-preferences-help">{{ t('imageSaveTypeHint') }}</p>
        </div>
      </div>
      <div class="preferences-item">
        <div class="header"><label for="image-save-path">{{ t(preferences.saveType === 'picgo' ? 'picgoEndpointOrProgram' : 'saveImagePath') }}</label></div>
        <div class="content">
          <div class="image-path-control">
            <ElInput ref="pathInput" id="image-save-path" :model-value="preferences.path" :disabled="disabled" v-control-a11y="{ id: 'image-save-path', label: t(preferences.saveType === 'picgo' ? 'picgoEndpointOrProgram' : 'saveImagePath'), describedBy: preferences.invalidPathKey ? 'image-save-path-hint image-save-path-error' : 'image-save-path-hint', invalid: Boolean(preferences.invalidPathKey) }" @update:model-value="preferences.changePath" />
            <ElButton v-if="preferences.saveType === 'sepc'" :disabled="disabled" @click="preferences.chooseDirectory(t('chooseImageFolder'))">{{ t('chooseImageFolder') }}</ElButton>
          </div>
          <p id="image-save-path-hint" class="image-preferences-help">{{ t(pathHint, { filename: '${filename}' }) }}</p>
          <p id="image-save-path-error" class="image-field-error" :role="preferences.invalidPathKey ? 'alert' : undefined">{{ preferences.invalidPathKey ? t(preferences.invalidPathKey) : '' }}</p>
        </div>
      </div>
      <div class="preferences-item right">
        <div class="content"><ElButton class="image-preferences-save" type="primary" native-type="submit" :loading="preferences.saving" :disabled="disabled">{{ t('saveImageSettings') }}</ElButton></div>
      </div>
      <div v-if="preferences.errorKey" class="image-preferences-error" role="alert">
        <span>{{ t(preferences.errorKey) }}</span>
        <ElButton size="small" :disabled="preferences.busy" @click="retry">{{ t('retry') }}</ElButton>
      </div>
    </form>
  </section>
</template>
<script lang="ts" setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElSelect, ElOption, ElInput, ElButton, type InputInstance } from 'element-plus';
import { useImagePreferencesStore } from '../../store/imagePreferences';
import { vControlA11y } from '../../directives/controlA11y';

const { t } = useI18n();
const preferences = useImagePreferencesStore();
const pathInput = ref<InputInstance>();
const composing = ref(false);
const disabled = computed(() => preferences.busy || preferences.closePrompt || !preferences.loaded);
const pathHint = computed(() => preferences.saveType === 'default' ? 'imageRelativePathHint' : preferences.saveType === 'sepc' ? 'imageAbsolutePathHint' : 'picgoPathHint');
onMounted(() => { void preferences.load(); });
async function save() { if (composing.value) return; await preferences.save(); if (preferences.invalidPathKey) { await nextTick(); pathInput.value?.focus(); } }
async function retry() { await preferences.retry(); if (preferences.invalidPathKey) { await nextTick(); pathInput.value?.focus(); } }
</script>
<style lang="scss">
.preferences-image {
  font-family: var(--fontFamily);
  .image-preferences-status { min-height: 24px; margin: 12px 0 4px; font-size: 12px; line-height: 1.5; }
  .image-preferences-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0; padding: 8px; border: 1px solid var(--contentBorderColor); font-size: 12px; line-height: 1.5; }
  .image-preferences-help { margin: 8px 0; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
  .image-path-control { display: flex; gap: 8px; align-items: center; .el-input { min-width: 0; flex: 1; } .el-button { flex: none; margin-left: 0; } }
  .image-field-error { min-height: 20px; margin: 8px 0; font-size: 12px; line-height: 1.5; }
  .image-preferences-save { width: 200px; max-width: 100%; }
  label { cursor: pointer; }
  .el-button:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
}
@media (max-width: 600px) { .preferences-image .image-path-control { flex-wrap: wrap; .el-input { flex-basis: 100%; } } }
</style>
