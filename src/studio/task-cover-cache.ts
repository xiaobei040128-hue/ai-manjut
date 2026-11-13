import {coverImage} from '../cover-images';
export type TaskCoverPreview={source:string;dataUri:string};
const cache=new Map<string,{uri:string;ready:Promise<void>;image?:HTMLImageElement}>();
export function taskCoverSource(source:string){return cache.get(source)?.uri||coverImage(source,'thumbnail');}
export function knownTaskCover(source?:string){return source&&cache.has(source)?source:'';}
export function forgetTaskCover(source:string){cache.delete(source);}
export function prepareTaskCover(preview?:TaskCoverPreview):Promise<void>{
 if(!preview||typeof preview.source!=='string'||typeof preview.dataUri!=='string'||preview.dataUri.length>81000||!/^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(preview.dataUri))return Promise.resolve();
 const old=cache.get(preview.source);if(old?.uri===preview.dataUri)return old.ready;
 const entry:{uri:string;ready:Promise<void>;image?:HTMLImageElement}={uri:preview.dataUri,ready:Promise.resolve()};cache.set(preview.source,entry);while(cache.size>64)cache.delete(cache.keys().next().value!);
 if(typeof Image==='undefined')return entry.ready;
 const image=new Image();entry.image=image;image.decoding='async';
 entry.ready=new Promise<void>(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve();},timer=setTimeout(finish,100);image.onload=finish;image.onerror=finish;image.src=preview.dataUri;if(image.decode)void image.decode().then(finish,finish);else if(image.complete)finish();});return entry.ready;
}
