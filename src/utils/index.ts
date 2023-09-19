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