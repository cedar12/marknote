<template>
<div class="folder-container">
  <div class="folder-search">
    <el-input
      v-model="filterText"
      size="small"
      placeholder="过滤"
      :suffix-icon="Search"
      clearable
    />
  </div>
  <ElScrollbar style="height:calc(100% - 30px);">
    <el-tree  :key="appStore.folder||undefined" ref="treeRef" :load="loadNode" lazy :data="treeData" node-key="path" :props="props" empty-text="" @node-click="nodeClick" v-loading="loading" :filter-node-method="filterNode">
      <template #empty>
        <!-- <ElButton size="">打开文件夹</ElButton> -->
      </template>
      <template #default="{ node, data }">
        <span class="folder-tree-node">
          <span class="file-type-icon" :class="{'file-type-dir':data.dir}">
            <FolderOpen theme="filled" v-if="data.dir&&node.expanded"></FolderOpen>
            <FolderClose theme="filled" v-else-if="data.dir"></FolderClose>
            <img theme="filled" :src="logoPng" v-else class="img-icon"/>
          </span>
          <span :title="data.path">{{ node.label }}</span>
        </span>
      </template>
    </el-tree>
  </ElScrollbar>
</div>
</template>
<script lang="ts" setup>
// @ts-nocheck
import {onMounted,ref,watch} from 'vue';
import { ls, read } from '../api/file';
import {ElTree,ElScrollbar,ElInput} from 'element-plus';
import {FolderClose,FolderOpen,Search} from '@icon-park/vue-next';
import type Node from 'element-plus/es/components/tree/src/model/node';
import {useEditorStore} from '../store/editor';
import {useAppStore} from '../store/app';
import logoPng from '../assets/logo.png';

const appStore=useAppStore();
const editorStore=useEditorStore();

interface Tree {
  name: string
  dir: boolean
  path: string
  children: Tree[]
}

const props = {
  label: 'name',
  children: 'children',
  isLeaf: 'file',
}

const treeData=ref<Tree[]>([]);
const loading=ref(false);
const treeRef=ref();

const filterText = ref('');

watch(()=>filterText.value, (val) => {
  // console.log(treeRef);
  treeRef.value!.filter(val)
})


const filterNode = (value: string, data: Tree,_child: Node) => {
  if (!value) return true
  // console.log(data);
  return data.name.includes(value)
}


async function loadDirData(root:string):Promise<Tree[]>{
  // loading.value=false;
  try{
    const res:any=await ls(root);
    if(res.code===0){
      const data=res.data as Tree;
      if(data.name==''){
        data.name=root;
      }
      return [data];
    }
  }catch(e){
    console.error(e);
    
  }finally{
    // loading.value=false;
  }
  return [];
}

const loadNode = async (node: Node, resolve: (data: Tree[]) => void) => {
  if (node.level === 0) {
    if(!appStore.folder){
      return resolve([]);
    }
    var data=await loadDirData(appStore.folder);
    return resolve(data)
  }
  var data=await loadDirData(node.data.path);
  return resolve(data[0].children);
}

onMounted(async ()=>{
  // await loadDirData();
})

async function nodeClick(data:Tree){
  if(data.dir)return;
  if(!await appStore.guardUnsavedChanges())return;
  editorStore.loading=true;
  try{
    const resp:any=await read(data.path);
    if (resp.code === 0) {
      appStore.setFilepath(data.path);
      await editorStore.setContent(resp.data);
    }
  }catch(e){
    console.error(e);
  }finally{
    editorStore.loading=false;
  }
}
</script>
<style lang="scss">
.folder-container{
  height: 100%;
  
}
</style>
<style lang="scss">
.folder-container{
  width: 100%;
  height: calc(100vh - var(--titleBarHeight));
  .folder-search{
    --el-fill-color-light: var(--primaryBackgroundColorHover);
    --el-fill-color-blank: var(--primaryBackgroundColor);
    --el-text-color-regular: var(--primaryTextColor);
      padding-right: 8px;
      .el-input__wrapper{
        box-shadow:none;
      }
      .i-icon.i-icon-search{
        display:flex;
        justify-content:center;
        align-items:center;
      }
  }
  .el-tree{
    --el-fill-color-light:var(--primaryBackgroundColor);
    --el-fill-color-blank:var(--primaryBackgroundColor);
    --el-tree-text-color:var(--primaryTextColor);
    --el-tree-node-hover-bg-color:var(--primaryBackgroundColorHover);
    
    .folder-tree-node{
      // height:var(--el-tree-node-content-height);
      display: flex;
      align-items: center;
      .file-type-dir{
        color: var(--primaryTextColorHover);
      }
      .file-type-icon,.file-type-icon .i-icon{
        display: inline-flex;
        align-items: center;
      }
      .file-type-icon+span{
        margin-left: 4px;
        display: inline-flex;
        align-items: center;
      }
      .img-icon{
        width: 16px;
        height: 16px;
      }
    }
    
  }
  
}
</style>
