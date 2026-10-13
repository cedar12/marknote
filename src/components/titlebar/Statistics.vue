<template>
  <el-popover :visible="visible" role="dialog" :title="t('statisticsTitle')" placement="bottom-start" :width="'auto'" :offset="-4" trigger="click"
    popper-class="titlebar-words-popover" popper-style="min-width:auto;">
    <template #reference>
      <button ref="trigger" v-click-outside="closePopover" type="button" class="titlebar-words" :aria-label="accessibleLabel" :title="accessibleLabel" :aria-expanded="visible" @click="visible=!visible" @keydown.esc="closePopover">
        <span>{{ count }}</span><span>{{ t(mode) }}</span>
      </button>
    </template>
    <div ref="options" class="titlebar-statistics-options" @keydown.esc="closePopover">
      <button type="button" :aria-pressed="mode==='words'" @click="mode='words'">{{ t('words') }}</button>
      <button type="button" :aria-pressed="mode==='chars'" @click="mode='chars'">{{ t('chars') }}</button>
    </div>
  </el-popover>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { ClickOutside, ElPopover } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useEditorStore } from '../../store/editor';

const store = useEditorStore();
const { t } = useI18n();
const mode = ref<'words' | 'chars'>('words');
const visible = ref(false);
const trigger = ref<HTMLButtonElement>();
const options = ref<HTMLDivElement>();
const vClickOutside = ClickOutside;
const closePopover = (event?: Event) => {
  if (event?.type !== 'keydown' && event?.target instanceof Node && options.value?.contains(event.target)) return;
  visible.value = false;
  if (event?.type === 'keydown') trigger.value?.focus();
};
const statistics = computed(() => store.sourceMode!=='wysiwyg' ? store.sourceStatistics : store.documentStatistics);
const count = computed(() => statistics.value ? mode.value === 'words' ? statistics.value.words : statistics.value.characters : store.statisticsError ? '—' : '…');
const accessibleLabel = computed(() => !statistics.value ? t(store.statisticsError ? 'statisticsUnavailable' : 'statisticsCalculating') : `${count.value} ${t(mode.value)}`);
</script>

<style scoped lang="scss">
.titlebar-words {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
  border: 0;
  padding: 0 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  &:focus-visible { outline: 2px solid var(--primaryTextColor); outline-offset: -2px; }
}
.titlebar-statistics-options {
  display: flex;
  flex-direction: column;
  button {
    border: 0;
    padding: 5px 8px;
    background: transparent;
    color: var(--contentTextColor);
    font: inherit;
    text-align: left;
    cursor: pointer;
    &:hover { background: var(--contentBackgroundColorHover); }
    &:focus-visible { outline: 2px solid var(--primaryTextColor); }
    &[aria-pressed="true"] { font-weight: 700; }
  }
}
</style>
