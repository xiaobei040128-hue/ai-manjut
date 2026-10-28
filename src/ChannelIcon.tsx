export default function ChannelIcon({id}:{id:string}){
 if(id==='uid')return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#F0E8F7"/><rect x="6" y="8" width="20" height="16" rx="3" stroke="#805B9A" strokeWidth="1.6"/><circle cx="12" cy="14" r="2.2" stroke="#805B9A" strokeWidth="1.5"/><path d="M8.5 20c.5-3 6.5-3 7 0M19 13h4m-4 4h4m-4 3h2" stroke="#805B9A" strokeWidth="1.5" strokeLinecap="round"/></svg>;
 if(id==='tron')return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#EB0029"/><path d="m7 7 19 4-11 16L7 7Zm0 0 13 9m6-5-6 5m-5 11 5-11" stroke="white" strokeWidth="1.35" strokeLinejoin="round"/></svg>;
 return id==='bank_wire'?<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12 16 5l12 7v3H4zM7 17v8m6-8v8m6-8v8m6-8v8M4 28h24"/></svg>:<img src={'/brands/'+(id==='okx'?'okx.png':id+'.svg')} alt=""/>;
}
