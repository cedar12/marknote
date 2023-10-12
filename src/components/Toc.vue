
<template>
   <div class="marknote-outliner" v-if="editor">
        <div class="outliner-tree">
            <ElScrollbar height="100%">
                  <div class="outliner-item" v-show="heading.show" v-for="(heading, index) in headings" :key="index">
                    <span class="outliner-icon" @click="onClickIcon(heading)" :style="{marginLeft: (heading.level*10)+'px'}">
                      <span style="width: 1em;height:1em;" v-if="headings.length-1===index||(heading.level>=headings[index+1].level)"></span>
                      <Plus v-else-if="heading.status==='close'"/>
                      <Minus v-else-if="heading.status==='open'"/>
                    </span>
                    <a class="outliner-hash"  :class="`level-${heading.level}`"  :href="`#${heading.id}`">
                      {{ heading.text }}
                    </a>
                  </div>
            </ElScrollbar>
        </div>
    </div>
 
</template>
  
<script lang="ts" setup>
// import { onMounted,nextTick,watch } from 'vue';
import { useEditorStore,Heading } from '../store/editor';
// import { useAppStore } from '../store/app';
import { storeToRefs } from 'pinia';
import {ElScrollbar} from 'element-plus';
import {Plus,Minus} from '@icon-park/vue-next';

// const appStore=useAppStore();
const editorStore = useEditorStore();
const { editor,headings } = storeToRefs(editorStore);

// const headings = ref<Heading[]>([]);
/*
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
        status:'open',
        show:true,
      })
    }
  })

  transaction.setMeta('addToHistory', false)
  transaction.setMeta('preventUpdate', true)

  editor.value.view.dispatch(transaction)

  headings.value=items;
  console.log('headings',editorStore.headings);
}*/
// onMounted(() => {
//   editor.value.on('update', editorStore.updateHeadings);
//   nextTick(editorStore.updateHeadings);
// })


// watch(()=>appStore.filepath,()=>{
//   editorStore.updateHeadings();
// })

const onClickIcon=(heading:Heading)=>{
  if(heading.status==='open'){
    heading.status='close';
    showChild(heading,false);
  }else if(heading.status==='close'){
    heading.status='open';
    showChild(heading,true);
  }
}

const showChild=(heading:Heading,show:boolean)=>{
  const hs:Heading[]=[];
  const level=heading.level;
  const id=heading.id;
  let range=false;
  for(let i=0;i<headings.value.length;i++){
    const h=headings.value[i];
    
    if(range===false&&h.id===id){
      range=true;
    }else if(range&&h.level<=level){
      range=false;
    }
    if(range&&h.id!==id){
      h.show=show;
      h.status=show?'open':'close';
    }
    hs.push({...h});
  }
  headings.value=hs;
}
</script>
  

<style lang="scss">
.marknote-outliner{
    // background-color: var(--primaryBackgroundColor);
    // color: var(--primaryTextColor);
    // padding-top: var(--titleBarHeight);
    --el-fill-color-light: var(--primaryBackgroundColorHover);
    --el-fill-color-blank: var(--primaryBackgroundColor);
    --el-text-color-regular: var(--primaryTextColor);
    .outliner-tree{
        height: calc(100vh - var(--titleBarHeight));
        overflow: hidden;
        .outliner-item{
          user-select: none;
            padding: 2px 0 4px 0;
            display: flex;
            align-items: center;
            .outliner-hash{
              text-decoration: none;
              outline: none;
              cursor: pointer;
              color: var(--primaryTextColor);
            }
            .outliner-icon{
              display: inline-block;
              padding-right: 2px;
              color: #a8a8a8;
              .i-icon{
                cursor: pointer;
              }
              &>span{
                display: flex;
                justify-content: center;
                align-items: center;
              }
            }
            @for $i from 1 through 6{
                .level-#{$i}{
                    // position: relative;
                    // margin-left: 15px*$i;
                    // &::after{
                    //     content: '';
                    //     display: block;
                    //     position: absolute;
                    //     top: 0;
                    //     left: -18px;
                    //     font-size: .4em;
                    //     color: #abaeb1;
                    // }
                }
            }
        }
    }
}


</style>