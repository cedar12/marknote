
import { createI18n } from 'vue-i18n';


export default function i18n(){
  const localeFiles = import.meta.glob("./locale/*.js", { eager: true });
  const messages:any={}
  for(let locale in localeFiles){
    messages[locale.replace('./locale/','').replace('.js','')]=(localeFiles[locale] as any).default;
  }
  // console.log(messages);
  return createI18n({
    locale: localStorage.getItem("lang")||'cn',
    fallbackLocale: 'en',
    messages,
    legacy: false,
  });
}