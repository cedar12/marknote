import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import Preferences from "./components/Preferences.vue";

import  createI18n from "./i18n";

import "./scss/editor.scss";
import { createPinia } from 'pinia'
import {isPreferences} from "./utils/index";
// import 'tippy.js/dist/tippy.css';
const i18n=createI18n();

createApp(isPreferences?Preferences:App).use(i18n).use(createPinia()).mount("#app");


