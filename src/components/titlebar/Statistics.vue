<template>
  <el-popover :visible="visible" role="dialog" :title="t('statisticsScope')" placement="bottom-start" :width="'auto'" :offset="-4" trigger="click"
    popper-class="titlebar-words-popover" popper-style="min-width:auto;">
    <template #reference>
      <button ref="trigger" v-click-outside="closePopover" type="button" class="titlebar-words" :aria-label="accessibleLabel" :title="accessibleLabel" :aria-expanded="visible" @click="visible=!visible" @keydown.esc="closePopover">
        <span>{{ count }}</span><span>{{ t(mode) }}</span>
        <span v-if="store.segmented || store.sourceMode!=='wysiwyg'" class="statistics-scope">{{ scopeLabel }}</span>
      </button>
    </template>
    <div ref="options" class="titlebar-statistics-options" @keydown.esc="closePopover">
      <button type="button" :aria-pressed="mode==='words'" @click="mode='words'">{{ t('words') }}</button>
      <button type="button" :aria-pressed="mode==='chars'" @click="mode='chars'">{{ t('chars') }}</button>
      <template v-if="store.segmented && store.sourceMode==='wysiwyg'">
        <div class="statistics-group-label" aria-hidden="true"></div>
        <button type="button" :aria-pressed="store.statisticsScope==='document'" @click="store.setStatisticsScope('document')">{{ t('statisticsDocument') }}</button>
        <button type="button" :aria-pressed="store.statisticsScope==='segment'" @click="store.setStatisticsScope('segment')">{{ t('statisticsCurrentSegment') }}</button>
      </template>
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
const statistics = computed(() => store.sourceMode!=='wysiwyg' ? store.sourceStatistics : !store.segmented || store.statisticsScope === 'document' ? store.documentStatistics : store.currentStatistics);
const count = computed(() => statistics.value ? mode.value === 'words' ? statistics.value.words : statistics.value.characters : store.statisticsError ? '—' : '…');
const scopeLabel = computed(() => t(store.sourceMode!=='wysiwyg' ? 'statisticsSource' : store.statisticsScope === 'document' ? 'statisticsDocument' : 'statisticsCurrentSegment'));
const accessibleLabel = computed(() => !statistics.value ? t(store.statisticsError ? 'statisticsUnavailable' : 'statisticsCalculating') : `${count.value} ${t(mode.value)}${store.segmented || store.sourceMode!=='wysiwyg' ? ', ' + scopeLabel.value : ''}`);
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
.statistics-scope { font-size: 11px; opacity: .8; }
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
.statistics-group-label { padding: 5px 8px; border-top: 1px solid var(--contentBorderColor); }
</style>
