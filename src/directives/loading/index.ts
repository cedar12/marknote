
function createInstance(el: HTMLElement){
  el.style.position = 'relative'
  const mask = document.createElement('div') // 创建最外层div 高度占满（包含滚动）
  const loadingBox = document.createElement('div') // 显示loading的div 高度是100vh

// 下面所添加的class样式都会在后面贴出
  mask.setAttribute('class', 'marknote-loading')
  loadingBox.setAttribute('class', 'marknote-loading-box')

  mask.appendChild(loadingBox)
  el.appendChild(mask)
}

export default {
  mounted() {},
  beforeUpdate() {},
  updated(el: HTMLElement, binding: any) {
    
    if (binding.oldValue !== binding.value) {
      if (binding.value && !binding.oldValue) {
        createInstance(el)
      }else{
        const mesk=el.querySelector('.marknote-loading');
        if(mesk){
          el.removeChild(mesk);
        }
        
      }
    }
  },
  beforeUnmount(el: HTMLElement) {
    const mesk=el.querySelector('.marknote-loading');
    if(mesk){
      el.removeChild(mesk);
    }
  },
  unmounted() {}
}
