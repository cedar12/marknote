import { Component, ComputedOptions, MethodOptions } from "vue";




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


export async function handleHtml(html:HTMLElement){
  const cloned=html.cloneNode(true) as HTMLElement;
  const images=cloned.querySelectorAll('img.el-image__inner');
  for(let i=0;i<images.length;i++){
    // @ts-ignore
    if(!images[i].src.startsWith('data:image/')){
      try{
        // @ts-ignore
        const base64=await convertImageToBase64(images[i].src);
        // console.log(base64);
        // @ts-ignore
        images[i].src=base64;
      }catch(e){
        console.error(e);
      }
    }
    
  }
  return cloned.innerHTML;
}
function convertImageToBase64(imgUrl:string):Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin='anonymous';
    image.onload = () => {
      try{
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = image.naturalHeight;
        canvas.width = image.naturalWidth;
        ctx?.drawImage(image, 0, 0);
        const dataUrl = canvas.toDataURL();
        resolve(dataUrl);
      }catch(err){
        reject(err);
      }
    };
    image.onerror = (err) => {
      reject(err);
    };
    image.src = imgUrl;
  });
  
}
