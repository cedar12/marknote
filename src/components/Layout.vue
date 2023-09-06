<template>
  <div class="marknote-layout">
    
    <div class="layout-content">
      <WysiwygEditor/>
    </div>
    
  </div>
  
</template>
<script lang="ts" setup>
import WysiwygEditor from "./WysiwygEditor.vue";
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