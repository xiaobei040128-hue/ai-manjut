import {loadCatalog} from './catalogs';
import {useSyncExternalStore} from 'react';
export const languages=[{code:'en',name:'English',locale:'en-US'},{code:'fr',name:'Français',locale:'fr-FR'},{code:'de',name:'Deutsch',locale:'de-DE'},{code:'es',name:'Español',locale:'es-ES'},{code:'pt',name:'Português',locale:'pt-PT'},{code:'ka',name:'ქართული',locale:'ka-GE'},{code:'ru',name:'Русский',locale:'ru-RU'},{code:'ar',name:'العربية',locale:'ar-EG'},{code:'id',name:'Bahasa Indonesia',locale:'id-ID'},{code:'zh-SG',name:'Singapore',locale:'zh-SG'}] as const;
export type Language=typeof languages[number]['code'];
const key='ai-creator-language-v1';
const valid=(value:unknown):value is Language=>languages.some(l=>l.code===value);
let language:Language='en';try{const stored=localStorage.getItem(key);if(valid(stored))language=stored;}catch{/* Language selection remains usable without storage. */}
const listeners=new Set<()=>void>();
let revision=0,request=0;
const snapshot=()=>language+':'+revision;
function changed(){revision++;listeners.forEach(fn=>fn());}
export const getLanguage=()=>language;
export const getFormatLocale=()=>languages.find(l=>l.code===language)!.locale;
function apply(){const admin=location.pathname.includes('admin');document.documentElement.lang=admin?'zh-CN':language;document.documentElement.dir=!admin&&language==='ar'?'rtl':'ltr';}
if(typeof document!=='undefined')apply();
export async function setLanguage(next:Language){if(!valid(next)||language===next)return;const version=++request;await loadCatalog(next);if(version!==request)return;language=next;try{localStorage.setItem(key,next);}catch{}apply();changed();}
function subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function useLanguage(){useSyncExternalStore(subscribe,snapshot,()=> 'en:0');return language;}
void loadCatalog(language).then(changed).catch(()=>{});

if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===key&&valid(event.newValue))void setLanguage(event.newValue).catch(()=>{});});
