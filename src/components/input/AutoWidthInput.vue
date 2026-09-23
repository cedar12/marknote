<template>
<div class="auto-width-input">
  <input :value="props.value" type="text" ref="inputRef" @input="onInput" @change="onChange" @blur="emit('blur')" />
</div>
</template>
<script lang="ts" setup>
import { ref,onMounted,onUnmounted,nextTick } from 'vue'

const props=defineProps(['value']);
const emit = defineEmits(['update:value','change','blur']);

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


defineExpose({
  focus(){
    inputRef.value?.focus();
  },
  blur(){
    inputRef.value?.blur();
  }
});

const setWidth = function () {
  const textboxEle = inputRef.value;
  if(fakeEle){
    const string =
    textboxEle?.value || textboxEle?.getAttribute("placeholder") || "";
    fakeEle.innerHTML = string.replace(/\s/g, "&nbsp;");
    nextTick(()=>{
      if(textboxEle){
        const fakeEleStyles = window.getComputedStyle(fakeEle as Element);
        textboxEle.style.width = fakeEleStyles.width;
      }
      
    });
    
  }
  
};

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
  fakeEle.style.fontStyle = styles.fontStyle||"normal";
  fakeEle.style.fontWeight = styles.fontWeight||"400px";
  fakeEle.style.letterSpacing = styles.letterSpacing||"normal";
  fakeEle.style.textTransform = styles.textTransform||"none";

  fakeEle.style.borderLeftWidth = styles.borderLeftWidth||"0px";
  fakeEle.style.borderRightWidth = styles.borderRightWidth||"0px";
  fakeEle.style.paddingLeft = styles.paddingLeft;
  fakeEle.style.paddingRight = styles.paddingRight;

  document.body.appendChild(fakeEle);

  setWidth();

  textboxEle.addEventListener("input", setWidth);
  
});

onUnmounted(()=>{
  const textboxEle = inputRef.value;
  if(textboxEle){
    textboxEle.removeEventListener("input", setWidth);
  }
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
    background: transparent;
    font-style: normal;
    font-weight: 400;
    letter-spacing: normal; 
    text-transform: none; 
    border-left-width: 0px; 
    border-right-width: 0px;
  }
}
</style>