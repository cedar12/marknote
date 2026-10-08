<template>
    <node-view-wrapper class="toc">
      <div class="toc__title">{{ t('outliner') }}</div>
      <ul class="toc__list">
        <li
          class="toc__item"
          :class="`toc__item--${heading.level}`"
          v-for="heading in headings"
          :key="heading.id"
        >
          <a :href="`#${heading.id}`" @click.prevent="editorStore.navigateToHeading(heading)">
            {{ heading.text }}
          </a>
        </li>
      </ul>
    </node-view-wrapper>
  </template>

  <script lang="ts" setup>
  import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';
  import { computed } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useEditorStore } from '../../store/editor';

  defineProps(nodeViewProps);
  const editorStore = useEditorStore();
  const { t } = useI18n();
  const headings = computed(() => editorStore.headings.filter(heading => heading.segmentIndex === editorStore.segmentIndex));
  </script>


  <style lang="scss">
  .toc {
    opacity: 0.75;
    border-radius: 0.5rem;
    padding: 0.75rem;
    background: rgba(black, 0.1);

    &__list {
      list-style: none;
      padding: 0;

    }

    &__title {
        display: block;
        font-weight: 700;
        letter-spacing: 0.025rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        opacity: 0.5;
    }

    &__item {
      a:hover {
        opacity: 0.5;
      }

      &--3 {
        padding-left: 1rem;
      }

      &--4 {
        padding-left: 2rem;
      }

      &--5 {
        padding-left: 3rem;
      }

      &--6 {
        padding-left: 4rem;
      }
    }
  }
  </style>
