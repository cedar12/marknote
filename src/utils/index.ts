import { Component, ComputedOptions, MethodOptions } from "vue";
import html2canvas from "html2canvas";




export function getUrlParams(url:string) {
	if(url.indexOf('?')==-1){
		return {};
	}
    let urlStr = url.split('?')[1]
	let obj:any = {};
	let paramsArr = urlStr.split('&')
	for(let i = 0,len = paramsArr.length;i < len;i++){
		let arr = paramsArr[i].split('=')
		obj[arr[0]] = arr[1];
	}
	return obj
}

export const isPreferences=getUrlParams(window.location.href)?.preferences==='open';

export function component(app:Component<any, any, any, ComputedOptions, MethodOptions>,components:{[key:string]:Component<any, any, any, ComputedOptions, MethodOptions>}){
	if(getUrlParams(window.location.href)?.preferences==='open'){
		return components['Preferences'];
	}
	if(getUrlParams(window.location.href)?.about==='open'){
		return components['About'];
	}
	return app;
}

const IMAGE_EXT=['.png','.jpg','.gif','.ico','.bmp'];
export function isImage(path:string){
	const src=path.toLocaleLowerCase();
	const result=IMAGE_EXT.find(e=>src.endsWith(e));
	return result!=undefined&&result!=null;
}


export function toImage(element:HTMLElement,windowHeight:number):Promise<HTMLCanvasElement>{
  const scrollTop=element.scrollTop;
  const all=document.createElement('canvas');
  all.width=element.clientWidth;
  all.height=element.scrollHeight;
  const ctx=all.getContext('2d');
  const partCount=all.height/windowHeight+Math.ceil(all.height/windowHeight%1);
  return new Promise(async (resolve,reject)=>{
    try{
      for(let i=0;i<=partCount;i++){
        let top=i*windowHeight;
        let offset=all.height-top;
        element.scrollTop=top;
        let canvas=await html2canvas(element,{
          backgroundColor: null,
          useCORS: true,
          y:offset<windowHeight?windowHeight-offset:0,
          height:offset<windowHeight?offset:windowHeight,
        });
        const tempCtx=canvas.getContext('2d');
        var heightPos=0;
        if(i==partCount){
          heightPos=all.height-i*windowHeight;
        }
        const imgData=tempCtx?.getImageData(0,heightPos,canvas.width,canvas.height);
        if(imgData){
          ctx?.putImageData(imgData,0,top);
        }
      }
      
      //const imgData = canvas.toDataURL('image/jpeg', 1.0);
      element.scrollTop=scrollTop;
      resolve(all);
    }catch(e){
      reject(e);
    }
    
  })
}