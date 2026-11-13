export function initializeCustomerClock(db){db.exec('CREATE TABLE IF NOT EXISTS customer_timezones(owner_id TEXT PRIMARY KEY,time_zone TEXT NOT NULL,updated_at TEXT NOT NULL)');}
const validatedZones=new Map(),dateFormatters=new Map();
function remember(cache,key,value,limit=128){cache.set(key,value);if(cache.size>limit)cache.delete(cache.keys().next().value);return value;}
export function validTimeZone(value){if(typeof value!=='string'||value.length>100)return null;if(validatedZones.has(value))return validatedZones.get(value);try{return remember(validatedZones,value,new Intl.DateTimeFormat('en',{timeZone:value}).resolvedOptions().timeZone);}catch{return remember(validatedZones,value,null);}}
export function rememberCustomerTimeZone(db,id,value){const zone=validTimeZone(value);if(!zone)return;const old=db.prepare('SELECT time_zone FROM customer_timezones WHERE owner_id=?').get(id);if(old?.time_zone===zone)return;db.prepare('INSERT INTO customer_timezones VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET time_zone=excluded.time_zone,updated_at=excluded.updated_at').run(id,zone,new Date().toISOString());}
export function customerTimeZone(db,id){return db.prepare('SELECT time_zone FROM customer_timezones WHERE owner_id=?').get(id)?.time_zone||'Asia/Shanghai';}
function parts(at,zone){let formatter=dateFormatters.get(zone);if(!formatter)formatter=remember(dateFormatters,zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));const p=Object.fromEntries(formatter.formatToParts(at).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return p;}
export function customerLocalDate(at,zone){const p=parts(at,zone);return p.year+'-'+p.month+'-'+p.day;}
export function localWallTime(day,hour,zone){const[y,m,d]=day.split('-').map(Number),target=Date.UTC(y,m-1,d,hour);let value=target;for(let i=0;i<6;i++){const p=parts(new Date(value),zone),actual=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));const diff=target-actual;if(!diff)break;value+=diff;}return new Date(value);}
export function nextCustomerFive(completedAt,zone){const day=customerLocalDate(new Date(completedAt),zone),next=new Date(day+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);return localWallTime(next.toISOString().slice(0,10),5,zone).toISOString();}

// Find UTC boundaries by calendar day, including DST midnight gaps and skipped dates.
export function customerDayBounds(day,zone){
 const next=new Date(day+'T12:00:00.000Z');next.setUTCDate(next.getUTCDate()+1);const nextDay=next.toISOString().slice(0,10);
 const boundary=target=>{const center=Date.parse(target+'T00:00:00.000Z');let low=center-36*3600000,high=center+36*3600000;while(high-low>1){const mid=Math.floor((low+high)/2);if(customerLocalDate(new Date(mid),zone)<target)low=mid;else high=mid;}return new Date(high).toISOString();};
 return {start:boundary(day),end:boundary(nextDay)};
}
