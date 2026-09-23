<template>
  <div class="search-and-replace-tool" :class="{replace:isReplace}" v-if="editorStore.findVisbile">
    <div class="tool-more">
      <button v-if="!isReplace" @click="isReplace=true"><Right/></button>
      <button v-else  @click="isReplace=false"><Down/></button>
    </div>
    <div class="tool-content">
      <div class="search-content">
      <span v-if="editorStore.segmented" class="segment-search-scope">{{t('currentSegmentOnly')}}</span>
      <input ref="serachRef" v-model="searchTerm" type="text" :placeholder="t('find')"
                autofocus="true" @keydown.enter="updateSearchReplace()">
                <span class="results-count-info" v-if="total===0">{{t('noResult')}}</span>
                <span class="results-count-info" v-else>{{index}}/{{total}}</span>
                <button @click="updateSearchReplace()"><ArrowDown/></button>
                <button @click="updateSearchReplace(true)"><ArrowUp/></button>
                <button @click="clear();editorStore.findVisbile=false"><Close/></button>
      </div>
      <div class="replace-content" v-if="isReplace">
        <input v-model="replaceTerm" type="text" :placeholder="t('replace')"/><button @click="replace">{{t('replace')}}</button><button @click="replaceAll">{{t('replaceAll')}}</button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { onMounted, ref, watch,nextTick } from "vue";
import { useEditorStore } from '../store/editor';
import { storeToRefs } from 'pinia';
import {ArrowDown,ArrowUp,Close,Right,Down} from '@icon-park/vue-next';
import { useI18n } from 'vue-i18n';

const {t} = useI18n();
const editorStore = useEditorStore();
const { editor } = storeToRefs(editorStore);

const searchTerm = ref<string>("");

const replaceTerm = ref<string>("");

const index=ref<number>(0);
const total=ref<number>(0);

const isReplace=ref<boolean>(false);

const serachRef=ref<HTMLElement>();

const updateSearchReplace = (p?:boolean) => {
      if (!editor.value) return;
      // if(editor.value.storage.searchAndReplace.index!==undefined){
      //   index.value=editor.value.storage.searchAndReplace.index;
      // }
      
      editor.value.commands.setSearchTerm(searchTerm.value);
      editor.value.commands.setReplaceTerm(replaceTerm.value);
      const results=editor.value.storage.searchAndReplace.results;
      total.value=results.length;
      if(results.length===0){
        return;
      }
      if(index.value>=results.length){
        index.value=0;
      }
      if(p===true){
        if(index.value<=1){
          index.value=results.length;
        }else{
          index.value=index.value-1;
        }
      }else{
        if(index.value>=results.length){
          index.value=1;
        }else{
          index.value=index.value+1;
        }
      }
      const lastSearchTerm =editor.value.storage.searchAndReplace.lastSearchTerm;
      console.log(results,lastSearchTerm,index.value);
      const result=results[index.value-1];
      if(!result){
        return;
      }
      editor.value.commands.setTextSelection({from:result.from,to:result.to});
      editor.value.commands.scrollIntoView();
      editor.value.commands.focus();
      
};

// watch(
//       () => replaceTerm.value.trim(),
//       (val, oldVal) => (val === oldVal ? null : updateSearchReplace())
// );

watch(
      () => searchTerm.value,
      (val) => {if(val === ''){updateSearchReplace()}}
);

watch(()=>editorStore.findVisbile,(val)=>{
  if(val===true){
    nextTick(()=>{
      serachRef.value?.focus();
    })
  }
})

const replace = () => {
  updateSearchReplace();
  editor.value?.commands.replace()
  updateSearchReplace();
};

const clear = () => {
  searchTerm.value = replaceTerm.value = "";
  updateSearchReplace();
};

const replaceAll = () => {
  updateSearchReplace();
  editor.value?.commands.replaceAll();
  updateSearchReplace();
}
onMounted(() => {
  nextTick(()=>{
    serachRef.value?.focus();
  })
  
  
  setTimeout(()=>{
    
    updateSearchReplace();
  })
})
</script>
<style lang="scss">
.search-and-replace-tool{
  z-index: 9997;
  position:absolute;
  top:calc(var(--titleBarHeight) + 10px);
  right: 10px;
  background: var(--contentBackgroundColor);
  color: var(--contentTextColor);
  border-radius: 4px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 3px solid var(--primaryTextColor);
  box-shadow: 0px 0px 4px var(--contentBorderColor);
  padding: 2px;
  display:flex;
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
    margin-top: 4px;
  }
  input{
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
    &:hover{
      background-color: var(--contentBackgroundColorHover);
    }
  }
  
}
.search-result{
  background-color: #ffd90080;
}
</style>
