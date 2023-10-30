<template>
<div class="auto-width-input">
  <input :value="props.value" type="text" ref="inputRef" @input="onInput" @change="onChange" />
</div>
</template>
<script lang="ts" setup>
import { ref,onMounted,onUnmounted } from 'vue'

const props=defineProps(['value']);
const emit = defineEmits(['update:value','change']);

const inputRef = ref<HTMLInputElement>();


const onInput=(event:Event)=>{
  // @ts-ignore
  emit('update:value',event.target?.value);
}
const onChange=(event:Event)=>{
  // @ts-ignore
  emit('change',event.target?.value);
}

var fakeEle:null|HTMLElement=null;

onMounted(()=>{
  if(!inputRef.value)return;
  const textboxEle = inputRef.value;
  const styles = window.getComputedStyle(textboxEle);

  fakeEle = document.createElement("div");
  fakeEle.style.position = "absolute";
  fakeEle.style.top = "0";
  fakeEle.style.left = "-9999px";
  fakeEle.style.overflow = "hidden";
  fakeEle.style.visibility = "hidden";
  fakeEle.style.whiteSpace = "nowrap";
  fakeEle.style.height = "0";

  fakeEle.style.fontFamily = styles.fontFamily;
  fakeEle.style.fontSize = styles.fontSize;
  fakeEle.style.fontStyle = styles.fontStyle;
  fakeEle.style.fontWeight = styles.fontWeight;
  fakeEle.style.letterSpacing = styles.letterSpacing;
  fakeEle.style.textTransform = styles.textTransform;

  fakeEle.style.borderLeftWidth = styles.borderLeftWidth;
  fakeEle.style.borderRightWidth = styles.borderRightWidth;
  fakeEle.style.paddingLeft = styles.paddingLeft;
  fakeEle.style.paddingRight = styles.paddingRight;

  document.body.appendChild(fakeEle);

  const setWidth = function () {
    if(fakeEle){
      const string =
      textboxEle.value || textboxEle.getAttribute("placeholder") || "";
      fakeEle.innerHTML = string.replace(/\s/g, "&nbsp;");

      const fakeEleStyles = window.getComputedStyle(fakeEle as Element);
      textboxEle.style.width = fakeEleStyles.width;
    }
    
  };

  setWidth();

  textboxEle.addEventListener("input", setWidth);
  
});

onUnmounted(()=>{
  
  if(fakeEle){
    document.body.removeChild(fakeEle);
  }

});


</script>
<style lang="scss">
.auto-width-input{
  display:inline-block;
  input{
    min-width: 20px;
    padding: 0.2em;
    outline: none;
    border: none;
  }
}
</style>