import {ref,watchEffect} from 'vue';
import { Editor } from '@tiptap/core';

import deepEqual from 'deep-equal';

type MapFn<T, R> = (arg: T) => R;

function mapSelf<T>(d: T): T {
  return d;
}

export function useAttributes<T, R = T>(editor: Editor, attrbute: string, defaultValue?: T, map?: (arg: T) => R) {
  const mapFn = (map || mapSelf) as MapFn<T, R>;
  // @ts-ignore
  const value=ref(mapFn(defaultValue));
  const prevValueCache = ref(value.value);

  watchEffect(() => {
    const listener = () => {
      const attrs = { ...defaultValue, ...editor.getAttributes(attrbute) };
      Object.keys(attrs).forEach((key) => {
        // @ts-ignore
        if (attrs[key] === null || attrs[key] === undefined) {
          // @ts-ignore
          attrs[key] = defaultValue[key];
        }
      });
      // @ts-ignore
      const nextAttrs = mapFn(attrs);
      // @ts-ignore
      if (deepEqual(prevValueCache.current, nextAttrs)) {
        return;
      }
      // @ts-ignore
      value.value=nextAttrs;
      // @ts-ignore
      prevValueCache.current = nextAttrs;
    };

    editor.on('selectionUpdate', listener);
    editor.on('transaction', listener);

    return () => {
      editor.off('selectionUpdate', listener);
      editor.off('transaction', listener);
    };
  });
  //, [editor, defaultValue, attrbute, mapFn]
  return value;
}