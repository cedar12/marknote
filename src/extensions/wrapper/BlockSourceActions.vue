<template>
  <div class="block-source-actions" contenteditable="false">
    <ElTooltip v-if="showCode !== undefined" size="small" :content="t('code')" :trigger="['hover', 'focus']" :trigger-keys="[]">
      <ElButton size="small" :aria-label="t('code')" :aria-pressed="showCode"
        @pointerdown.stop.prevent @mousedown.stop.prevent @click.stop="emit('update:showCode', !showCode)">
        <Code />
      </ElButton>
    </ElTooltip>
    <ElTooltip size="small" :content="copyLabel" :trigger="['hover', 'focus']" :trigger-keys="[]">
      <ElButton size="small" :aria-label="copyLabel" :aria-busy="copying" :aria-disabled="copying"
        @pointerdown.stop.prevent @mousedown.stop.prevent @click.stop="handleCopy">
        <Check v-if="copyStatus === 'copied'" />
        <Copy v-else />
      </ElButton>
    </ElTooltip>
    <span class="copy-status" role="status">{{ copyStatus === 'idle' ? '' : copyLabel }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { ElButton, ElTooltip } from 'element-plus';
import { Check, Code, Copy } from '@icon-park/vue-next';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{ source: string; showCode?: boolean }>(), { showCode: undefined });
const emit = defineEmits<{ (event: 'update:showCode', value: boolean): void }>();
const { t } = useI18n();
const copying = ref(false);
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle');
const copyLabel = computed(() => t(copyStatus.value === 'copied' ? 'copied' : copyStatus.value === 'failed' ? 'copyFailed' : 'copy'));
let copyStatusTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

const handleCopy = async () => {
  if (copying.value) return;
  copying.value = true;
  copyStatus.value = 'idle';
  clearTimeout(copyStatusTimer);
  try {
    await writeText(props.source);
    if (disposed) return;
    copyStatus.value = 'copied';
    copyStatusTimer = setTimeout(() => { copyStatus.value = 'idle'; }, 2000);
  } catch (error) {
    if (disposed) return;
    copyStatus.value = 'failed';
    console.error('Block source copy failed:', error);
  } finally {
    if (!disposed) copying.value = false;
  }
};

onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(copyStatusTimer);
});
</script>

<style lang="scss">
@import './blockSource.scss';

.block-source-actions {
  display: flex;
  align-items: center;

  .el-button {
    background-color: transparent;

    &[aria-busy="true"] {
      cursor: progress;
    }
  }

  .copy-status {
    position: absolute;
    width: 1px;
    height: 1px !important;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

.exporting .block-source-actions {
  visibility: hidden;
}
</style>
