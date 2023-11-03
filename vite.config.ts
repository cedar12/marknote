import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { terser } from "rollup-plugin-terser";
import topLevelAwait from 'vite-plugin-top-level-await';
//@ts-ignore
import package from './package.json';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    topLevelAwait({
      // The export name of top-level await promise for each chunk module
      promiseExportName: '__mn',
      // The function to generate import names of top-level await promise in each chunk module
      promiseImportName: i => `__mn_${i}`
    }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // 3. to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ["VITE_", "TAURI_"],
  build:{
    minify:'terser',
    cssMinify:true,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions:{
      treeshake:true,
      output:{
        manualChunks(id){
          if(id.includes('node_modules')){
            // @ts-ignore
            const dependenciesKeys = Object.keys(package.dependencies);
            const match = dependenciesKeys.find((item) => {
                return id.includes(item);
            });
            const notSplit = ['vue'];
            if (match && !notSplit.includes(match)) {
                return match;
            }
          }
        }
      },
      plugins:[
        terser({
          format:{
            comments: false,
          }
        })
      ]
    }
  }
}));
