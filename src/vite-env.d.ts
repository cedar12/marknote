/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent, ShallowRef } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}


declare interface Window {
  editor: ShallowRef<Editor | undefined>;
}