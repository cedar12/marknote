import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import Preferences from "./components/Preferences.vue";

import  i18n from "./i18n";
// import 'element-plus/dist/index.css';
import './scss/element-plus.scss';

import "./scss/editor.scss";
import './scss/codeTheme.scss';
import { createPinia } from 'pinia'
import {isPreferences} from "./utils/index";
import {ElLoadingDirective} from 'element-plus';

createApp(isPreferences?Preferences:App).directive('loading',ElLoadingDirective).use(i18n).use(createPinia()).mount("#app");


