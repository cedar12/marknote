
import light from './style/light';
import dark from './style/dark';
import { findThemes} from '../api/utils';
import mermaid from 'mermaid';

const builtInThemes=[light,dark];
const excludes=builtInThemes.map(t=>t.value);

const themes=[...builtInThemes,...await getThemes()];

async function getThemes(){
  const themes:ThemeItem[]=[];
  const s=await findThemes();
  s.forEach(json=>{
    const theme=JSON.parse(json) as ThemeItem;
    if(excludes.includes(theme.value)){
      return;
    }
    themes.push(theme);
  })
  return themes;
}

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
  mermaid.initialize({
    theme: value.type==='light'?'default':'dark',
  });
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
