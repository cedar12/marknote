import { watch, type Directive, type WatchStopHandle } from 'vue';
import i18n from '../../i18n';

interface LoadingInstance {
  mask: HTMLElement;
  label: HTMLElement;
  position: string;
  busy: string | null;
  stopLocaleWatch: WatchStopHandle;
}

const instances = new WeakMap<HTMLElement, LoadingInstance>();

function removeInstance(el: HTMLElement) {
  const instance = instances.get(el);
  if (!instance) return;
  instance.stopLocaleWatch();
  instance.mask.remove();
  el.style.position = instance.position;
  if (instance.busy === null) el.removeAttribute('aria-busy');
  else el.setAttribute('aria-busy', instance.busy);
  instances.delete(el);
}

function updateInstance(el: HTMLElement, loading: boolean, compact: boolean) {
  if (!loading) {
    removeInstance(el);
    return;
  }

  let instance = instances.get(el);
  if (!instance) {
    const position = el.style.position;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

    const mask = document.createElement('div');
    mask.className = 'marknote-loading';
    mask.setAttribute('role', 'status');
    mask.setAttribute('aria-live', 'polite');

    const label = document.createElement('span');
    label.className = 'marknote-loading-label';
    const skeleton = document.createElement('div');
    skeleton.className = 'marknote-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    const appendBlock = (parent: HTMLElement, variant = '') => {
      const block = document.createElement('div');
      block.className = 'marknote-skeleton-block' + (variant ? ' marknote-skeleton-' + variant : '');
      parent.appendChild(block);
    };
    appendBlock(skeleton, 'title');
    for (let paragraphIndex = 0; paragraphIndex < 3; paragraphIndex += 1) {
      if (paragraphIndex === 1) appendBlock(skeleton, 'heading');
      const paragraph = document.createElement('div');
      paragraph.className = 'marknote-skeleton-paragraph';
      for (let lineIndex = 0; lineIndex < 3; lineIndex += 1) appendBlock(paragraph);
      skeleton.appendChild(paragraph);
    }
    mask.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
    });
    mask.append(label, skeleton);
    const stopLocaleWatch = watch(i18n.global.locale, () => {
      label.textContent = i18n.global.t('loadingContent');
    }, { immediate: true });
    instance = { mask, label, position, busy: el.getAttribute('aria-busy'), stopLocaleWatch };
    instances.set(el, instance);
    el.setAttribute('aria-busy', 'true');
    el.appendChild(mask);
  }

  instance.mask.classList.toggle('marknote-loading-compact', compact);
  instance.label.textContent = i18n.global.t('loadingContent');
}

const loading: Directive<HTMLElement, boolean> = {
  mounted(el, binding) {
    updateInstance(el, Boolean(binding.value), Boolean(binding.modifiers.compact));
  },
  updated(el, binding) {
    updateInstance(el, Boolean(binding.value), Boolean(binding.modifiers.compact));
  },
  beforeUnmount: removeInstance,
};

export default loading;
