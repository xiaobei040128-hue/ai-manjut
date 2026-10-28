import en from './locales/en.json';
export const english:Record<string,string>=en;
const loaded:Record<string,Record<string,string>>={en:english};
const loaders:Record<string,()=>Promise<{default:Record<string,string>}>>={fr:()=>import('./locales/fr.json'),de:()=>import('./locales/de.json'),es:()=>import('./locales/es.json'),pt:()=>import('./locales/pt.json'),ka:()=>import('./locales/ka.json'),ru:()=>import('./locales/ru.json'),ar:()=>import('./locales/ar.json'),id:()=>import('./locales/id.json')};
const pending:Record<string,Promise<void>|undefined>={};
export function readCatalog(code:string){return loaded[code]||english;}
export async function loadCatalog(code:string){if(code==='zh-SG'||loaded[code])return;if(!loaders[code])return;if(!pending[code])pending[code]=loaders[code]().then(m=>{loaded[code]=m.default;}).catch(e=>{delete pending[code];throw e;});await pending[code];}
