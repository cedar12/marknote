<template>
  <nav v-if="segmented" class="segment-navigation" :aria-label="t('largeFileNavigation')">
    <span class="segment-mode">{{ t('largeFileMode') }}</span>
    <span class="segment-position" aria-live="polite">
      {{ t('segmentPosition', { current: segmentIndex + 1, total: segmentCount }) }}
    </span>
    <button type="button" :disabled="segmentIndex === 0" @click="changeSegment(segmentIndex - 1, 'end')">
      {{ t('previousSegment') }}
    </button>
    <button type="button" :disabled="segmentIndex >= segmentCount - 1" @click="changeSegment(segmentIndex + 1, 'start')">
      {{ t('nextSegment') }}
    </button>
  </nav>
  <!-- <LinkMenu :editor="editor"></LinkMenu> -->
  <Menu></Menu>
  <EditorContent :editor="editor" ></EditorContent>
</template>
<script lang="ts" setup> 
import {onMounted,watch,nextTick} from 'vue';
import {EditorContent} from '@tiptap/vue-3';
import {useEditorStore} from '../store/editor';
import {useAppStore} from '../store/app';
import { storeToRefs } from 'pinia';
import Menu from '../extensions/menu/index.vue';
import { useI18n } from 'vue-i18n';

// import {createEditor} from '../utils/editor';
const appStore=useAppStore();
const editorStore=useEditorStore();
const {t}=useI18n();

// const editor=createEditor();

const {editor,segmented,segmentIndex,segmentCount} = storeToRefs(editorStore);

const changeSegment = async (index:number, focusPosition:'start'|'end') => {
  editorStore.showSegment(index, focusPosition);
  await nextTick();
  const scrollContainer=editor.value?.view.dom.closest('.el-scrollbar__wrap');
  scrollContainer?.scrollTo({top:0});
};


watch(()=>appStore.filepath,()=>{
  editorStore.updateHeadings();
})

onMounted(()=>{
  
/*
  const content=`
  # marknote
  所见即所得  🎉
  
  2. 1
  3. 2
  * [x] a
  * [x] b
  
  \`\`\` javascript
  console.log('marknote');
  \`\`\`

  > a~~bc~~

  ~~abc~~ **bold**

  |a |b |
  |:-|:-|
  |1 |2 |


  abc [baidu.com](https://www.baidu.com)
  \`\`\`rust
  fn main(){
    println!("marknote");
  }
  \`\`\`
  `;
  // console.log('mount editor',editor);

  */
  nextTick(()=>{
    // editorStore.setContent(content);
    editor.value?.commands.focus();
    editor.value?.on('update', editorStore.updateHeadings);
    editorStore.updateHeadings();
  })
  
})

</script>

<style lang="scss">
.segment-navigation {
  position: sticky;
  top: 0;
  z-index: 3;
  min-height: 34px;
  padding: 4px 12px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--contentTextColor);
  background: var(--contentBackgroundColor);
  border-bottom: 1px solid var(--contentBorderColor);

  .segment-mode {
    font-weight: 600;
  }

  .segment-position {
    margin-right: auto;
    color: var(--editorEchoTextColor);
    font-size: 12px;
  }

  button {
    min-height: 26px;
    padding: 2px 10px;
    border: 1px solid var(--contentBorderColor);
    border-radius: 4px;
    color: var(--contentTextColor);
    background: var(--contentBackgroundColor);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--contentBackgroundColorHover);
    }

    &:focus-visible {
      outline: 2px solid var(--primaryTextColor);
      outline-offset: 1px;
    }

    &:active:not(:disabled) {
      background: var(--contentBackgroundColorActive);
    }

    &:disabled {
      opacity: .45;
      cursor: default;
    }
  }
}
</style>
