import {getFormatLocale} from '../i18n/language';
const numbers=new Map<string,Intl.NumberFormat>();
export function amountNumber(cents:number){const locale=getFormatLocale();let f=numbers.get(locale);if(!f){f=new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2});numbers.set(locale,f);}return f.format(cents/100);}
