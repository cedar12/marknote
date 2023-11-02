/// <reference types="vite/client" />

import { PlatformType } from "./api/utils";

declare module "*.vue" {
  import type { DefineComponent, ShallowRef } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}




declare interface Window {
  editor: ShallowRef<Editor | undefined>;
  filesOpen:any;
  onFileOpen:(files)=>void;
  os: PlatformType;
}
