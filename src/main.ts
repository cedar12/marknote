import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import Preferences from "./components/Preferences.vue";

import  i18n from "./i18n";
import 'element-plus/dist/index.css';

import "./scss/editor.scss";
import './scss/codeTheme.scss';
import { createPinia } from 'pinia'
import {isPreferences} from "./utils/index";
// import 'tippy.js/dist/tippy.css';

createApp(isPreferences?Preferences:App).use(i18n).use(createPinia()).mount("#app");


