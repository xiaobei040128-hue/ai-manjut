const currencies=new Map<string,Intl.NumberFormat>();
const dates=new Map<string,Intl.DateTimeFormat>();
export function formatMoney(cents:number,locale:string){
 let formatter=currencies.get(locale);
 if(!formatter){formatter=new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2});currencies.set(locale,formatter);}
 return formatter.format(cents/100);
}
export function formatDate(iso:string,full:boolean,locale:string){
 const key=locale+':'+full;let formatter=dates.get(key);
 if(!formatter){formatter=new Intl.DateTimeFormat(locale,{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(full?{year:'numeric'}:{})});dates.set(key,formatter);}
 return formatter.format(new Date(iso));
}
