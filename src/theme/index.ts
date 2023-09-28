
import light from './style/light';
import dark from './style/dark';


const themes=[light,dark];

export default themes;

export function findThemeByType(type:ThemeType){
  return themes.find(t=>t.type===type);
}

export function setTheme(value:ThemeItem){
  if(!value||!value.style){
    return;
  }
  localStorage.setItem("theme", JSON.stringify(value));
  const keys=Object.keys(value.style);
  for(let key of keys){
    document.documentElement.style.setProperty('--'+key,(value.style as any)[key]);
  }

  document.documentElement.className=value.type;
}

export type ThemeType='light'|'dark';

export interface ThemeItem{
  label:string,
  value:string,
  type:ThemeType,
  style:ThemeStyle,
}


export interface ThemeStyle{
  primaryBackgroundColor: string;
  primaryBackgroundColorHover: string;
  primaryBackgroundColorActive: string;
  primaryTextColor: string;
  primaryTextColorHover: string;
  primaryTextColorActive: string;
  primaryBorderColor: string;
  contentBackgroundColor: string;
  contentBackgroundColorActive: string;
  contentBackgroundColorHover: string;
  contentTextColor: string;
  contentTextColorActive: string;
  contentTextColorHover: string;
  contentBorderColor: string;
  
}
