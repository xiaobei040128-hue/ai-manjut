export type SupportIdentity = {id:string; name:string; email:string};

// Only the configured SaleWisely chat entry receives customer information.
export function supportUrl(raw:string, identity:SupportIdentity|undefined, language:string) {
  if (!raw || !identity?.id) return raw;
  let url:URL;
  try {url=new URL(raw);} catch {return raw;}
  if (url.protocol!=='https:' || !['chat.aicreatorai.com','app.linechatai.com'].includes(url.hostname) || !/^\/c\/[a-f0-9]{32}\/?$/.test(url.pathname)) return raw;
  url.searchParams.set('user',JSON.stringify({
    userId:identity.id,
    userName:identity.id.slice(0,8).toUpperCase(),
    email:identity.email,
    language:(language==='zh-CN'||language==='zh-SG')?'zh':language,
  }));
  // Georgian is not currently supported by the provider's interface.
  url.searchParams.set('config',JSON.stringify({language:(language==='zh-CN'||language==='zh-SG')?'zh':language==='ka'?'en':language}));
  return url.toString();
}
