
import { createI18n } from 'vue-i18n';
// @ts-ignore
import zhCn from 'element-plus/dist/locale/zh-cn.mjs';
// @ts-ignore
import en from 'element-plus/dist/locale/en.mjs';


export function locales():{label:string,value:string}[]{
  const localeFiles = import.meta.glob("./locale/*.js", { eager: true });
  const list=[];
  for(let locale in localeFiles){
    list.push({
      label:(localeFiles[locale] as any).label||'Unknown',
      value:locale.replace('./locale/','').replace('.js',''),
    });
  }
  
  return list;
}

function initI18n(){
  const localeFiles = import.meta.glob("./locale/*.js", { eager: true });
  const messages:any={}
  for(let locale in localeFiles){
    messages[locale.replace('./locale/','').replace('.js','')]=(localeFiles[locale] as any).default;
  }
  return createI18n({
    locale: localStorage.getItem("lang")||'en',
    fallbackLocale: 'en',
    globalInjection: true,
    messages,
    legacy: false,
  });
}

const i18n=initI18n();

export default i18n;