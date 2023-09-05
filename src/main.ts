import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";

import  createI18n from "./i18n";

import "./scss/editor.scss";
import { createPinia } from 'pinia'


createApp(App).use(createI18n()).use(createPinia()).mount("#app");
