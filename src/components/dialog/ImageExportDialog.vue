<template>
  <ElConfigProvider :locale="elLocale">
    <ElDialog
      class="image-export-dialog"
      :model-value="imageExport.visible"
      :title="t('imageExportTitle')"
      width="480px"
      top="8vh"
      :z-index="100100"
      append-to-body
      :close-on-click-modal="false"
      :close-on-press-escape="!imageExport.pending"
      :show-close="!imageExport.pending"
      :before-close="beforeClose"
      @update:model-value="updateVisible"
      @opened="focusFirstControl"
      @closed="restoreEditorFocus"
    >
      <form id="image-export-options" ref="formRef" novalidate :aria-busy="imageExport.pending" @submit.prevent="submit">
        <p class="image-export-intro">{{ t('imageExportHint') }}</p>

        <div class="image-export-field">
          <span id="image-export-format-label" class="image-export-label">{{ t('imageExportFormat') }}</span>
          <ElRadioGroup v-model="imageExport.options.format" :label="t('imageExportFormat')" :disabled="imageExport.pending">
            <ElRadioButton label="png">PNG</ElRadioButton>
            <ElRadioButton label="jpeg">JPEG</ElRadioButton>
          </ElRadioGroup>
        </div>

        <div class="image-export-field">
          <label class="image-export-label" for="image-export-width">{{ t('imageExportWidth') }}</label>
          <div class="image-export-width-control">
            <ElInputNumber
              id="image-export-width"
              v-model="width"
              v-described-by="'image-export-width-hint'"
              :min="IMAGE_EXPORT_MIN_WIDTH"
              :max="IMAGE_EXPORT_MAX_WIDTH"
              :precision="0"
              :value-on-clear="DEFAULT_IMAGE_EXPORT_OPTIONS.width"
              :disabled="imageExport.pending"
              :label="t('imageExportWidth')"
              controls-position="right"
            />
            <span aria-hidden="true">{{ t('imageExportPixels') }}</span>
          </div>
          <p id="image-export-width-hint" class="image-export-help">{{ t('imageExportWidthHint') }}</p>
        </div>

        <div class="image-export-field">
          <span class="image-export-label">{{ t('imageExportResolution') }}</span>
          <ElRadioGroup v-model="imageExport.options.scale" :label="t('imageExportResolution')" :disabled="imageExport.pending">
            <ElRadioButton :label="1">{{ t('imageExportFast') }}</ElRadioButton>
            <ElRadioButton :label="2">{{ t('imageExportSharp') }}</ElRadioButton>
          </ElRadioGroup>
          <p class="image-export-help">{{ t('imageExportResolutionHint') }}</p>
        </div>

        <div class="image-export-field">
          <span class="image-export-label">{{ t('imageExportBackground') }}</span>
          <ElRadioGroup v-model="imageExport.options.background" :label="t('imageExportBackground')" :disabled="imageExport.pending">
            <ElRadioButton label="theme">{{ t('imageExportBackgroundTheme') }}</ElRadioButton>
            <ElRadioButton label="white">{{ t('imageExportBackgroundWhite') }}</ElRadioButton>
            <ElRadioButton label="transparent" :disabled="imageExport.options.format === 'jpeg'">{{ t('imageExportBackgroundTransparent') }}</ElRadioButton>
          </ElRadioGroup>
          <p class="image-export-help">{{ t('imageExportBackgroundHint') }}</p>
        </div>

        <div v-if="imageExport.options.format === 'jpeg'" class="image-export-field">
          <label class="image-export-label" for="image-export-quality">{{ t('imageExportQuality') }}</label>
          <div class="image-export-quality-control">
            <ElSlider
              id="image-export-quality"
              v-model="qualityPercent"
              v-described-by="'image-export-quality-hint'"
              :min="50"
              :max="100"
              :step="1"
              :disabled="imageExport.pending"
              :label="t('imageExportQuality')"
              :format-tooltip="formatPercent"
              :format-value-text="formatPercent"
            />
            <output for="image-export-quality">{{ formatPercent(qualityPercent) }}</output>
          </div>
          <p id="image-export-quality-hint" class="image-export-help">{{ t('imageExportQualityHint') }}</p>
        </div>
      </form>

      <template #footer>
        <div class="image-export-status" :role="imageExport.error && !imageExport.pending ? 'alert' : 'status'" :aria-live="imageExport.error && !imageExport.pending ? 'assertive' : 'polite'" aria-atomic="true">
          <span v-if="imageExport.pending">{{ pendingLabel }}</span>
          <p v-else-if="imageExport.error" class="image-export-error">{{ t(imageExport.error) }}</p>
        </div>
        <div class="image-export-actions">
          <ElButton :disabled="imageExport.pending" @click="imageExport.close()">{{ t('cancel') }}</ElButton>
          <ElButton
            class="image-export-submit"
            type="primary"
            native-type="submit"
            form="image-export-options"
            :loading="imageExport.pending"
            :disabled="imageExport.pending"
          >{{ imageExport.pending ? pendingLabel : t(imageExport.error ? 'imageExportRetry' : 'imageExportAction') }}</ElButton>
        </div>
      </template>
    </ElDialog>
  </ElConfigProvider>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch, type Directive } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElButton, ElConfigProvider, ElDialog, ElInputNumber, ElRadioButton, ElRadioGroup, ElSlider } from 'element-plus';
import en from 'element-plus/es/locale/lang/en';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { useImageExportStore } from '../../store/imageExport';
import { useEditorStore } from '../../store/editor';
import { DEFAULT_IMAGE_EXPORT_OPTIONS, IMAGE_EXPORT_MAX_WIDTH, IMAGE_EXPORT_MIN_WIDTH, normalizeImageExportOptions } from '../../utils/imageExportOptions';

const { t, locale } = useI18n();
const imageExport = useImageExportStore();
const editor = useEditorStore();
const formRef = ref<HTMLFormElement>();
const elLocale = computed(() => locale.value === 'zhCn' ? zhCn : en);
const pendingLabel = computed(() => t(imageExport.stage === 'saving' ? 'imageExportSaving'
  : imageExport.stage === 'rendering' ? 'imageExportRendering' : 'imageExportChoosingPath'));
const width = computed({
  get: () => imageExport.options.width,
  set: (value: number | undefined) => {
    imageExport.options.width = normalizeImageExportOptions({ ...imageExport.options, width: value }).width;
  },
});
const qualityPercent = computed({
  get: () => Math.round(imageExport.options.quality * 100),
  set: (value: number | number[]) => {
    if (typeof value === 'number') imageExport.options.quality = value / 100;
  },
});
const formatPercent = (value: number) => new Intl.NumberFormat(locale.value === 'zhCn' ? 'zh-CN' : 'en', {
  style: 'percent', maximumFractionDigits: 0,
}).format(value / 100);

// Attach help to the actual input/slider in Element Plus 2.4, rather than its wrapper.
const describeControl = (element: HTMLElement, hint: string) => {
  (element.querySelector('input, [role="slider"]') || element).setAttribute('aria-describedby', hint);
};
const vDescribedBy: Directive<HTMLElement, string> = {
  mounted: (element, binding) => describeControl(element, binding.value),
  updated: (element, binding) => describeControl(element, binding.value),
};

watch(() => imageExport.options.format, format => {
  if (format === 'jpeg' && imageExport.options.background === 'transparent') imageExport.options.background = 'white';
}, { flush: 'sync' });

function focusFirstControl() {
  formRef.value?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
}

async function restoreEditorFocus() {
  await nextTick();
  if (!imageExport.visible && !imageExport.pending) editor.editor?.commands.focus(undefined, { scrollIntoView: false });
}

function beforeClose(done: () => void) {
  if (imageExport.pending) return;
  imageExport.close();
  done();
}

function updateVisible(visible: boolean) {
  if (!visible && !imageExport.pending) imageExport.close();
}

async function submit() {
  if (!imageExport.pending) await imageExport.exportImage();
}
</script>

<style lang="scss">
.image-export-dialog {
  --el-dialog-bg-color: var(--contentBackgroundColor);
  --el-bg-color: var(--contentBackgroundColor);
  --el-bg-color-overlay: var(--contentBackgroundColor);
  --el-fill-color-blank: var(--contentBackgroundColor);
  --el-fill-color-light: var(--contentBackgroundColorActive);
  --el-fill-color: var(--contentBackgroundColorActive);
  --el-text-color-primary: var(--contentTextColor);
  --el-text-color-regular: var(--contentTextColor);
  --el-text-color-secondary: var(--contentTextColor);
  --el-border-color: var(--contentBorderColor);
  --el-border-color-light: var(--contentBorderColor);
  --el-disabled-bg-color: var(--contentBackgroundColorActive);
  --el-disabled-text-color: var(--contentTextColor);
  --el-disabled-border-color: var(--contentBorderColor);
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 8vh - 24px);
  max-height: calc(100dvh - 8vh - 24px);
  border-radius: 4px;
  color: var(--contentTextColor);
  font-family: var(--fontFamily);

  .el-dialog__header { flex: none; }
  .el-dialog__body { overflow-y: auto; min-height: 0; padding: 16px 20px 0; }
  .el-dialog__footer { flex: none; padding: 8px 20px 20px; text-align: left; }
  .image-export-intro { margin: 0 0 18px; font-size: 12px; line-height: 1.6; }
  .image-export-field { display: grid; gap: 8px; margin-bottom: 18px; }
  .image-export-label { font-size: 14px; font-weight: 500; }
  label.image-export-label { cursor: pointer; }
  .image-export-help { margin: 0; font-size: 12px; line-height: 1.5; }
  .image-export-width-control { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .image-export-quality-control { display: flex; align-items: center; gap: 16px; padding: 0 8px; }
  .image-export-quality-control .el-slider { min-width: 0; flex: 1; }
  .image-export-quality-control output { min-width: 4ch; font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; }
  .el-radio-group { display: flex; width: fit-content; max-width: 100%; }
  .el-radio-button__inner { padding-inline: 14px; }
  .image-export-status { min-height: 42px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
  .image-export-error { margin: 0; }
  .image-export-actions { display: flex; justify-content: flex-end; gap: 12px; }
  .image-export-actions .el-button { margin-left: 0; }
  .image-export-submit { width: 148px; flex: none; }
  .el-button:focus-visible,
  .el-radio-button:focus-within .el-radio-button__inner,
  .el-slider__button-wrapper:focus-visible,
  .el-input__wrapper.is-focus,
  .el-dialog__headerbtn:focus-visible { outline: 2px solid var(--primaryBorderColor); outline-offset: 2px; }
}

@media (max-width: 400px) {
  .image-export-dialog {
    .el-dialog__body { padding-inline: 16px; }
    .el-dialog__footer { padding-inline: 16px; }
    .el-radio-button__inner { padding-inline: 10px; }
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-export-dialog .is-loading { animation: none; }
}
</style>
