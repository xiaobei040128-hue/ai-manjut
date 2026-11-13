import info from '../../shared/site-information.json';
import type {Language} from '../i18n/language';
export const siteInformationKey=(language:Language)=>language==='zh-SG'?'zh':language;
export const siteInformation=(language:Language)=>info[siteInformationKey(language)];
export function siteInformationUrl(type:'faq'|'about'|'privacy',language:Language){const key=siteInformationKey(language);return '/'+type+(type==='privacy'?'-'+key:key==='ka'?'':'-'+key)+'.html';}
