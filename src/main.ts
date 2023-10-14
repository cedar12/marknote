import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import Preferences from "./components/Preferences.vue";
import About from "./components/About.vue";

import  i18n from "./i18n";
// import 'element-plus/dist/index.css';
import './scss/element-plus.scss';
import 'element-plus/theme-chalk/dark/css-vars.css';
import "./scss/editor.scss";
import './scss/codeTheme.scss';
import { createPinia } from 'pinia'
import {component} from "./utils/index";
import {ElLoadingDirective} from 'element-plus';


//isPreferences?Preferences:App
createApp(component(App,{Preferences,About})).directive('loading',ElLoadingDirective).use(i18n).use(createPinia()).mount("#app");


