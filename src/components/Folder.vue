<template>
<div class="folder-container">
  <ElScrollbar style="height:100%;">
    <el-tree ref="tree" :load="loadNode" lazy :data="treeData" node-key="path" :props="props" empty-text="" @node-click="nodeClick" v-loading="loading">
      <template #empty>
        <ElButton size="">打开文件夹</ElButton>
      </template>
      <template #default="{ node, data }">
        <span class="folder-tree-node">
          <span class="file-type-icon" :class="{'file-type-dir':data.dir}">
            <FolderOpen theme="filled" v-if="data.dir&&node.expanded"></FolderOpen>
            <FolderClose theme="filled" v-else-if="data.dir"></FolderClose>
            <!-- <DocDetail theme="filled" v-else></DocDetail> -->
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
import {onMounted,ref} from 'vue';
import { ls, read } from '../api/file';
import {ElTree,ElScrollbar,ElButton} from 'element-plus';
import {FolderClose,FolderOpen} from '@icon-park/vue-next';
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
    var data=await loadDirData('D:\\');
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
  editorStore.loading=true;
  const resp:any=await read(data.path);
  if (resp.code === 0) {
    appStore.setFilepath(data.path);
    editorStore.setContent(resp.data);
  }
  editorStore.loading=false;
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