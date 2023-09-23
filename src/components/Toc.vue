<template>
   <div class="marknote-outliner" v-if="editor">
        <!-- <button @click="handleClick">log</button> -->
        <div class="outliner-tree">
            <ElScrollbar height="100%">
                  <div class="outliner-item" v-for="(heading, index) in headings" :key="index">
                    <a class="outliner-hash"  :class="`level-${heading.level}`"  :href="`#${heading.id}`">
                      {{ heading.text }}
                    </a>
                    <!-- <span :class="'level-'+heading.level">{{ heading.text }}</span> -->
                  </div>
            </ElScrollbar>
        </div>
    </div>
 
</template>
  
<script lang="ts" setup>
import { ref, onMounted,nextTick,watch } from 'vue';
import { useEditorStore } from '../store/editor';
import { useAppStore } from '../store/app';
import { storeToRefs } from 'pinia';

const appStore=useAppStore();
const editorStore = useEditorStore();
const { editor } = storeToRefs(editorStore);

interface Heading{
  level: number,
  text: string,
  id: string,
}
const headings = ref<Heading[]>([]);


function handleUpdate() {
  headings.value = [];

  const items:Heading[]=[];
  const transaction = editor.value.state.tr

  editor.value.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const id = `heading-${items.length + 1}`

      if (node.attrs.id !== id) {
        transaction.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          id,
        })
      }

      items.push({
        level: node.attrs.level,
        text: node.textContent,
        id,
      })
    }
  })

  transaction.setMeta('addToHistory', false)
  transaction.setMeta('preventUpdate', true)

  editor.value.view.dispatch(transaction)

  headings.value=items;
}
onMounted(() => {
  editor.value.on('update', handleUpdate);
  nextTick(handleUpdate);
})


watch(()=>appStore.filepath,()=>{
  handleUpdate();
})
</script>
  

<style lang="scss">
.marknote-outliner{
    background-color: var(--primaryBackgroundColor);
    color: var(--primaryTextColor);
    padding-top: var(--titleBarHeight);
    --el-fill-color-light: var(--primaryBackgroundColorHover);
    --el-fill-color-blank: var(--primaryBackgroundColor);
    --el-text-color-regular: var(--primaryTextColor);
    .outliner-tree{
        height: calc(100vh - var(--titleBarHeight));
        overflow: hidden;
        .outliner-item{
            padding: 2px 0 2px 20px;
            cursor: pointer;
            .outliner-hash{
              text-decoration: none;
              outline: none;
              color: var(--primaryTextColor);
            }
            @for $i from 1 through 6{
                .level-#{$i}{
                    position: relative;
                    margin-left: 15px*$i;
                    &::after{
                        content: 'H#{$i}';
                        display: block;
                        position: absolute;
                        top: 0;
                        left: -18px;
                        font-size: .4em;
                        color: #abaeb1;
                    }
                }
            }
        }
    }
}


</style>