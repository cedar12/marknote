import { createApp } from "vue";
import "./styles.css";
import App from "./App.vue";
import Preference from "./components/Preference.vue";

import  createI18n from "./i18n";

import "./scss/editor.scss";
import { createPinia } from 'pinia'
import {getUrlParams} from "./utils/index";

const params=getUrlParams(window.location.href);

if(params.preferences==='open'){
    createApp(Preference).use(createI18n()).use(createPinia()).mount("#app");
}else{

    createApp(App).use(createI18n()).use(createPinia()).mount("#app");
}


