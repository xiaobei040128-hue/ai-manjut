import {english,readCatalog} from './catalogs';
import {getLanguage} from './language';
const standardNames:Record<string,string>={'币安':'Binance','币安 UID':'Binance UID','币安 / OKX':'Binance / OKX','比特币':'Bitcoin','比特链':'Bitcoin','Bitcoin 主网':'Bitcoin','TRX 链':'TRON (TRC20)','ETH 链':'Ethereum (ERC20)','万事达':'Mastercard','Visa / 万事达':'Visa / Mastercard','UID · 比特链 · TRX 链 · ETH 链':'UID · Bitcoin · TRON (TRC20) · Ethereum (ERC20)'};
const protectedText=new Set(['AI CREATOR','USD','BTC','ETH','USDT','USDC','Binance','OKX','Visa','Mastercard','UID','Memo / Tag','Bitcoin','Ethereum · ERC20','TRON · TRC20']);
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fragments=Object.keys(english).filter(k=>/[\u3400-\u9fff]/.test(k)).sort((a,b)=>b.length-a.length);
const pattern=new RegExp(fragments.map(escape).join('|'),'g');
const punctuation=(s:string)=>s.replace(/，/g,getLanguage()==='ar'?'، ':', ').replace(/。/g,'.').replace(/：/g,': ').replace(/；/g,'; ').replace(/（/g,' (').replace(/）/g,')').replace(/！/g,'!').replace(/？/g,'?');
export function translateText<T>(value:T,context?:string):T{
 if(typeof value!=='string'||!value.trim())return value;
 if(standardNames[value.trim()])return standardNames[value.trim()] as T;
 if(getLanguage()==='zh-SG'||protectedText.has(value.trim()))return value;
 const catalog=readCatalog(getLanguage()),trimmed=value.trim(),normalized=trimmed.replace(/\s+/g,' '),messageKey=context?normalized+'::'+context:normalized,direct=catalog[messageKey]||english[messageKey];
 if(direct)return (value.slice(0,value.indexOf(trimmed))+direct+value.slice(value.indexOf(trimmed)+trimmed.length)) as T;
 if(!/[\u3400-\u9fff]/.test(value))return punctuation(value) as T;
 return punctuation(value.replace(pattern,k=>catalog[k]||english[k]||k)) as T;
}
export function localizeNode<T>(value:T):T{if(typeof value==='string')return translateText(value);if(Array.isArray(value))return value.map(localizeNode) as T;return value;}
