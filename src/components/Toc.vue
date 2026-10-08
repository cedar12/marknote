<template>
  <nav v-if="editor" class="marknote-outliner" :aria-label="t('outliner')" :aria-busy="busy">
    <div class="outliner-search">
      <ElInput ref="searchInput" v-model="search" size="small" :placeholder="t('filterHeadings')" :aria-label="t('filterHeadings')">
        <template #suffix>
          <button v-if="search" type="button" class="outliner-clear" :aria-label="t('clearHeadingFilter')" :title="t('clearHeadingFilter')" @click="clearSearch">
            <CloseSmall aria-hidden="true" />
          </button>
          <Search v-else aria-hidden="true" />
        </template>
      </ElInput>
    </div>
    <ElScrollbar class="outliner-scrollbar">
      <p v-if="!headings.length || !visibleHeadings.length" class="outliner-empty" role="status">
        {{ t(headings.length ? 'noMatchingHeadings' : 'noHeadings') }}
      </p>
      <ul v-else class="outliner-list">
        <li v-for="item in visibleHeadings" :key="item.heading.id" class="outliner-item" :style="{ paddingLeft: `${(item.heading.level - 1) * 10}px` }">
          <button
            v-if="item.hasChildren && !query"
            type="button"
            class="outliner-toggle"
            :aria-expanded="item.heading.status === 'open'"
            :aria-label="t(item.heading.status === 'open' ? 'collapseHeading' : 'expandHeading', { heading: item.heading.text || t('untitledHeading') })"
            :title="t(item.heading.status === 'open' ? 'collapseHeading' : 'expandHeading', { heading: item.heading.text || t('untitledHeading') })"
            @click="toggleHeading(item.heading)"
          >
            <Plus v-if="item.heading.status === 'close'" aria-hidden="true" />
            <Minus v-else aria-hidden="true" />
          </button>
          <span v-else class="outliner-toggle-placeholder" aria-hidden="true"></span>
          <button type="button" class="outliner-heading" :disabled="busy" @click="navigate(item.heading)">
            {{ item.heading.text || t('untitledHeading') }}
          </button>
        </li>
      </ul>
      <p v-if="navigationFailed" class="outliner-error" role="alert">{{ t('headingNavigationFailed') }}</p>
    </ElScrollbar>
  </nav>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { ElScrollbar, ElInput, type InputInstance } from 'element-plus';
import { Plus, Minus, Search, CloseSmall } from '@icon-park/vue-next';
import { useEditorStore, type Heading } from '../store/editor';

const { t } = useI18n();
const editorStore = useEditorStore();
const { editor, headings, loading, renderingDocument, navigatingToHeading } = storeToRefs(editorStore);
const search = ref('');
const searchInput = ref<InputInstance>();
const navigating = ref(false);
const navigationFailed = ref(false);
const query = computed(() => search.value.trim().toLocaleLowerCase());
const busy = computed(() => navigating.value || navigatingToHeading.value || loading.value || renderingDocument.value);

// Filtering searches the complete outline, including collapsed descendants.
// Reopening a parent preserves the disclosure state of its descendants.
const visibleHeadings = computed(() => {
  const hiddenLevels: number[] = [];
  return headings.value.flatMap((heading, index) => {
    while (hiddenLevels.length && heading.level <= hiddenLevels[hiddenLevels.length - 1]) hiddenLevels.pop();
    const hidden = hiddenLevels.length > 0;
    if (heading.status === 'close') hiddenLevels.push(heading.level);
    const matches = (heading.text || t('untitledHeading')).toLocaleLowerCase().includes(query.value);
    if (query.value ? !matches : hidden) return [];
    return [{ heading, hasChildren: headings.value[index + 1]?.level > heading.level }];
  });
});

function toggleHeading(heading: Heading) {
  heading.status = heading.status === 'open' ? 'close' : 'open';
}

function clearSearch() {
  search.value = '';
  searchInput.value?.focus();
}

async function navigate(heading: Heading) {
  if (busy.value) return;
  navigating.value = true;
  navigationFailed.value = false;
  try {
    navigationFailed.value = !await editorStore.navigateToHeading(heading);
  } catch {
    navigationFailed.value = true;
  } finally {
    navigating.value = false;
  }
}
</script>

<style lang="scss">
.marknote-outliner {
  --el-fill-color-light: var(--primaryBackgroundColorHover);
  --el-fill-color-blank: var(--primaryBackgroundColor);
  --el-text-color-regular: var(--primaryTextColor);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;

  .outliner-search {
    flex: none;
    padding: 0 8px 4px 0;

    .el-input__wrapper { box-shadow: none; }
    .el-input__wrapper:focus-within { box-shadow: 0 0 0 1px var(--primaryBorderColor); }
    .i-icon { display: inline-flex; }
  }

  .outliner-scrollbar {
    flex: 1;
    min-height: 0;
  }

  .outliner-list {
    list-style: none;
    margin: 0;
    padding: 0 8px 8px 0;
  }

  .outliner-item {
    display: flex;
    align-items: flex-start;
    min-width: 0;
  }

  .outliner-toggle,
  .outliner-toggle-placeholder {
    flex: 0 0 20px;
    width: 20px;
    height: 26px;
    box-sizing: border-box;
  }

  button {
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--primaryTextColor);
    font: inherit;
    cursor: pointer;

    &:hover { background: var(--primaryBackgroundColorHover); }
    &:active { background: var(--primaryBackgroundColorActive); }
    &:focus-visible { outline: 1px solid var(--primaryBorderColor); outline-offset: -1px; }
    &:disabled { cursor: default; opacity: .6; background: transparent; }
  }

  .outliner-toggle,
  .outliner-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .outliner-clear { width: 20px; height: 20px; }

  .outliner-heading {
    flex: 1;
    min-width: 0;
    padding: 4px 2px;
    line-height: 18px;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .outliner-empty,
  .outliner-error {
    margin: 12px 8px 12px 4px;
    font-size: 12px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
}
</style>
