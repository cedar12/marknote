/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "turndown/lib/turndown.es" {
  import TurndownService from "turndown/lib/turndown.es"
  export default TurndownService; 
}

declare module 'turndown-plugin-gfm';