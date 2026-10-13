<template>
  <div class="search-and-replace-tool" :class="{replace:isReplace}" v-if="editorStore.findVisbile">
    <div class="tool-more">
      <button v-if="!isReplace" type="button" :aria-label="t('expandReplace')" :title="t('expandReplace')" :aria-expanded="false" @click="isReplace=true"><Right/></button>
      <button v-else type="button" :aria-label="t('collapseReplace')" :title="t('collapseReplace')" :aria-expanded="true" @click="isReplace=false"><Down/></button>
    </div>
    <div class="tool-content">
      <div class="search-content">
      <span v-if="editorStore.segmented" class="segment-search-scope">{{t('currentSegmentOnly')}}</span>
      <input ref="serachRef" v-model="searchTerm" type="text" :placeholder="t('find')" :aria-label="t('find')" :disabled="operationBlocked"
                @compositionstart="isComposing=true" @compositionend="finishComposition" @keydown="onSearchKeydown">
                <span class="results-count-info" role="status" aria-live="polite">{{total ? `${index}/${total}` : t('noResult')}}</span>
                <button type="button" :aria-label="t('clearSearch')" :title="t('clearSearch')" :class="{'search-clear-hidden':!searchTerm}" :disabled="!searchTerm || operationBlocked || isComposing" @click="clearQuery"><Close/></button>
                <button type="button" :aria-label="t('searchNextResult')" :title="t('searchNextResult')" :disabled="!total || operationBlocked || isComposing" @click="updateSearchReplace()"><ArrowDown/></button>
                <button type="button" :aria-label="t('searchPreviousResult')" :title="t('searchPreviousResult')" :disabled="!total || operationBlocked || isComposing" @click="updateSearchReplace(true)"><ArrowUp/></button>
                <button type="button" :aria-label="t('closeSearch')" :title="t('closeSearch')" @click="clear();editorStore.findVisbile=false"><Close/></button>
      </div>
      <div class="replace-content" v-if="isReplace">
        <input v-model="replaceTerm" type="text" :placeholder="t('replace')" :aria-label="t('replace')" :disabled="operationBlocked"/><button type="button" :disabled="!total || operationBlocked || isComposing" @click="replace">{{t('replace')}}</button><button type="button" :disabled="!total || operationBlocked || isComposing" @click="replaceAll">{{t('replaceAll')}}</button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import { useEditorStore } from '../store/editor';
import { useAppStore } from '../store/app';
import { storeToRefs } from 'pinia';
import { ArrowDown, ArrowUp, Close, Right, Down } from '@icon-park/vue-next';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const editorStore = useEditorStore();
const appStore = useAppStore();
const { editor } = storeToRefs(editorStore);
const searchTerm = ref('');
const replaceTerm = ref('');
const index = ref(0);
const total = ref(0);
const isReplace = ref(false);
const isComposing = ref(false);
const operationBlocked = computed(() => appStore.lifecycleBusy || appStore.exporting || editorStore.loading || editorStore.renderingDocument || editorStore.segmentLoading || editor.value?.isEditable === false);
const serachRef = ref<HTMLInputElement>();
let selectedTerm = '';

const refreshCounters = () => {
  const storage = editor.value?.storage.searchAndReplace;
  total.value = storage?.results.length || 0;
  index.value = total.value ? storage.index + 1 : 0;
};

const synchronizeSearch = () => {
  if (isComposing.value || (operationBlocked.value && searchTerm.value)) return;
  const current = editor.value;
  if (!current) return;
  if (current.storage.searchAndReplace.searchTerm !== searchTerm.value) current.commands.setSearchTerm(searchTerm.value);
  current.commands.setReplaceTerm(replaceTerm.value);
  refreshCounters();
};

const selectCurrentResult = () => {
  if (isComposing.value || operationBlocked.value) return;
  refreshCounters();
  const current = editor.value;
  const result = current?.storage.searchAndReplace.results[index.value - 1];
  if (!current || !result) return;
  selectedTerm = searchTerm.value;
  current.chain().setTextSelection(result).scrollIntoView().run();
  // Tiptap's focus command queues a frame. A later return to the search input
  // must not be overridden by that queued focus during IME composition.
  current.view.focus();
};

const updateSearchReplace = (previous = false) => {
  if (isComposing.value || operationBlocked.value) return;
  synchronizeSearch();
  if (!editor.value || !total.value) return;
  const storage = editor.value.storage.searchAndReplace;
  const target = selectedTerm !== searchTerm.value
    ? (previous ? total.value - 1 : 0)
    : (storage.index + (previous ? -1 : 1) + total.value) % total.value;
  editor.value.commands.setSearchIndex(target);
  selectCurrentResult();
};

watch(searchTerm, () => {
  if (isComposing.value) return;
  selectedTerm = '';
  synchronizeSearch();
}, { flush: 'sync' });

const finishComposition = (event: CompositionEvent) => {
  isComposing.value = false;
  if (!editorStore.findVisbile) return;
  searchTerm.value = (event.target as HTMLInputElement).value;
  selectedTerm = '';
  synchronizeSearch();
};

const onSearchKeydown = (event: KeyboardEvent) => {
  if (event.isComposing || isComposing.value || event.keyCode === 229 || event.key !== 'Enter') return;
  event.preventDefault();
  updateSearchReplace(event.shiftKey);
};

watch(editor, (current, previous) => {
  previous?.off('transaction', refreshCounters);
  current?.on('transaction', refreshCounters);
  synchronizeSearch();
}, { immediate: true });

watch(() => editorStore.segmentIndex, () => {
  selectedTerm = '';
  refreshCounters();
}, { flush: 'post' });

watch(() => editorStore.findVisbile, visible => {
  if (visible) {
    synchronizeSearch();
    void nextTick(() => serachRef.value?.focus());
  } else clear();
});

const replace = () => {
  if (operationBlocked.value || isComposing.value) return;
  synchronizeSearch();
  // Synchronizing the query must not advance the currently selected result.
  if (editor.value?.commands.replace()) selectCurrentResult();
};

const clear = () => {
  isComposing.value = false;
  searchTerm.value = replaceTerm.value = '';
  selectedTerm = '';
  synchronizeSearch();
};

const clearQuery = () => {
  searchTerm.value = '';
  selectedTerm = '';
  synchronizeSearch();
  serachRef.value?.focus();
};

const replaceAll = () => {
  if (operationBlocked.value || isComposing.value) return;
  synchronizeSearch();
  if (editor.value?.commands.replaceAll()) refreshCounters();
};

onBeforeUnmount(() => editor.value?.off('transaction', refreshCounters));
</script>
<style lang="scss">
.search-and-replace-tool{
  z-index: 9997;
  position:absolute;
  top:calc(var(--titleBarHeight) + 10px);
  right: 10px;
  max-width: calc(100vw - 20px);
  background: var(--contentBackgroundColor);
  color: var(--contentTextColor);
  border-radius: 4px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 3px solid var(--primaryTextColor);
  box-shadow: 0px 0px 4px var(--contentBorderColor);
  padding: 2px;
  display:flex;
  box-sizing: border-box;
  .tool-content { min-width: 0; }
  .search-clear-hidden { visibility: hidden; }
  &.replace{
    &>.tool-more{
      height:52px;
    }
  }
  &>.tool-more{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items:center;
    width: 16px;
    height:26px;
    button{
      width: 100%;
      height:100%;
      text-align: center;
      padding: 0;
    }
  }
  .search-content{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 1px;
    .segment-search-scope{
      margin: 0 6px 0 2px;
      color: var(--editorEchoTextColor);
      font-size: 12px;
    }
    .results-count-info{
      display: inline-block;
      width: 80px;
      padding-left: 4px;
      font-size: 14px;
    }
  }
  .replace-content{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  input{
    min-width: 80px;
    flex: 1 1 120px;
    width: 160px;
    max-width: 100%;
    box-sizing: border-box;
    // border:1px solid var(--contentBorderColor);
    border:none;
    background: transparent;
    padding: 4px 6px;
    margin-right: 4px;
    border-radius: 2px;
    &:focus{
      outline: 1px solid var(--primaryTextColor);
    }
  }
  button{
    background:transparent;
    border:none;
    border-radius: 4px;
    cursor: pointer;
    padding: 4px 6px;
    &:focus-visible { outline: 2px solid var(--primaryTextColor); outline-offset: 1px; }
    &:disabled { opacity: .45; cursor: default; }
    &:hover{
      background-color: var(--contentBackgroundColorHover);
    }
  }
  
}
.search-result{
  background-color: #ffd90080;
}
</style>
