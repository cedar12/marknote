<template>
  <div class="marknote-layout">
    
    <div class="layout-content">
      <ContextMenu :menu="menuItems">
        <WysiwygEditor/>
      </ContextMenu>
    </div>
    
  </div>
  
</template>
<script lang="ts" setup>
import WysiwygEditor from "./WysiwygEditor.vue";
import ContextMenu from "./contextMenu/index.vue";
import {ContextMenuItem} from "./contextMenu/useContextMenu";

const menuItems:ContextMenuItem[]=[
  {
    label:'复制',
    split:true,
  },
  {
    label:'粘贴',
    disabled:true
  }
];
</script>

<style lang="scss">
.marknote-layout{
  .layout-content{
    padding-top: var(--titleBarHeight);
    &>div{
      max-height: calc(100vh - var(--titleBarHeight));
      overflow: auto;
    }
  }
}
</style>