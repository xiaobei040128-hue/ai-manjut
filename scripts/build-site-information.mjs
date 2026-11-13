import aboutLocales from './about-locales.mjs';
import platformRules from './platform-rules.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const info=JSON.parse(readFileSync(new URL('../shared/site-information.json',import.meta.url),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const c=info.company;
const codes=['en','fr','de','es','pt','ka','ru','ar','id','zh'];
const labels={en:'English',fr:'Français',de:'Deutsch',es:'Español',pt:'Português',ka:'ქართული',ru:'Русский',ar:'العربية',id:'Bahasa Indonesia',zh:'zh-SG'};
for(const lang of codes)for(const type of ['about','faq']){
 const d=info[lang],suffix=lang==='ka'?'':'-'+lang,name=type+suffix+'.html',title=d[type];
 const nav=codes.map(k=>`<a href="/${type}${k==='ka'?'':'-'+k}.html" lang="${k==='zh'?'zh-SG':k}" data-language="${k==='zh'?'zh-SG':k}" ${k===lang?'aria-current="page"':''}>${labels[k]}</a>`).join('');
 const content=type==='about'?d.paragraphs.map(p=>`<p>${esc(p)}</p>`).join(''):d.questions.map(([q,a],i)=>`<details${i===0?' open':''}><summary>${i+1}. ${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
 const html=`<!doctype html><html lang="${lang==='zh'?'zh-SG':lang}" dir="${lang==='ar'?'rtl':'ltr'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · AI CREATOR</title><meta name="description" content="${esc(d.paragraphs[0])}"><link rel="icon" href="/icons/ai-creator-64-a2503d172634.png"><link rel="canonical" href="https://aicreatorai.com/${name}">${codes.map(k=>`<link rel="alternate" hreflang="${k==='zh'?'zh-SG':k}" href="https://aicreatorai.com/${type}${k==='ka'?'':'-'+k}.html">`).join('')}<style>*{box-sizing:border-box}body{margin:0;color:#392b46;background:#f8f5fb;font:16px/1.85 system-ui,-apple-system,"Segoe UI",sans-serif}a{color:#704a95}header,main,footer{max-width:900px;margin:auto;padding:26px 24px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}header a{text-decoration:none}header strong{font-size:21px;letter-spacing:1px}nav{display:flex;gap:16px;flex-wrap:wrap;font-size:14px}nav [aria-current]{font-weight:750;text-decoration:underline;text-underline-offset:6px}.hero{border-bottom:1px solid #e5dbee;padding-bottom:24px;margin-bottom:26px}.hero small{color:#8e71a5;letter-spacing:3px}h1{font-size:clamp(26px,5vw,40px);line-height:1.35;overflow-wrap:anywhere;margin:12px 0}main{background:white;border:1px solid #e9dfef;border-radius:24px;padding:32px;margin-bottom:20px}article p{margin:0 0 24px}details{border-bottom:1px solid #eee6f2;padding:20px 0}summary{font-weight:650;cursor:pointer;padding-right:12px}details p{color:#66556f;margin:16px 0 0;white-space:normal}footer{font-size:12px;color:#887d91;overflow-wrap:anywhere;text-align:center;padding-top:4px;padding-bottom:24px}footer .company-signature{margin:0;letter-spacing:.3px;font-size:11px}footer details{border:0;padding:0;margin-top:4px}footer summary{display:inline-block;font-weight:400;font-size:11px;color:#96899e;padding:6px;list-style:none}footer summary:after{content:"⌄";margin-left:6px}footer details[open] summary:after{content:"⌃"}footer details>div{max-width:650px;margin:8px auto 0;padding:12px;border:1px solid #eee8f2;border-radius:12px;text-align:start;background:#ffffff70}footer details p{margin:4px 0;font-size:11px;line-height:1.7;color:#887d91}footer a{color:inherit}.footer-nav{padding:22px 0;border-top:1px solid #eee6f2}.notice{padding:16px;background:#f6f0fa;border-radius:12px}a:focus-visible,summary:focus-visible{outline:3px solid #ad89ce;outline-offset:5px}@media(max-width:600px){main{border-radius:18px;margin:0 12px;padding:24px 18px}header,footer{padding:22px}nav{gap:12px}}body{font-size:15px;line-height:1.8;background:#f7f5fa;color:#51415d}header,main,footer{max-width:820px}main{border-radius:20px;padding:30px 34px;border-color:#ece5f1;box-shadow:0 4px 20px #38204404}article p{margin-bottom:20px}header strong{font-size:19px;letter-spacing:.5px;color:#74518c}nav{gap:10px 16px}nav a{padding:5px 0;line-height:1.5}h1{font-weight:650;letter-spacing:-.7px;font-size:clamp(25px,4vw,34px)}summary{font-weight:550}a:focus-visible,summary:focus-visible{outline:2px solid #aa8fbe;outline-offset:4px}@media(max-width:600px){header,footer{padding:20px 18px}main{margin:0 12px 20px;padding:24px 20px;border-radius:17px}nav{gap:7px 14px;font-size:12px}details{padding:16px 0}}</style></head><body><header><a href="/"><strong>AI CREATOR</strong></a><nav aria-label="Language">${nav}</nav></header><main><div class="hero"><small>AI CREATOR</small><h1>${esc(title)}</h1></div><article>${content}</article><nav class="footer-nav"><a href="/about${suffix}.html">${esc(d.about)}</a><a href="/faq${suffix}.html">${esc(d.faq)}</a><a href="/privacy-${lang}.html">${esc(d.privacy)}</a><a href="/">${esc(d.home)}</a></nav></main><footer><p class="company-signature">AI CREATOR HUB LTD · No. ${c.number}</p><details><summary>${d.companyLabel}</summary><div><p>${esc(d.identity)}</p><p>${esc(d.registered)}: ${esc(c.registered)}</p><p>${esc(d.operating)}: ${esc(c.operating)}</p><p><a href="mailto:${c.email}">${c.email}</a></p></div></details></footer><script>document.querySelectorAll('[data-language]').forEach(a=>a.addEventListener('click',()=>{try{localStorage.setItem('ai-creator-language-v1',a.dataset.language)}catch{}}));</script></body></html>`;
 writeFileSync(new URL('../public/'+name,import.meta.url),html+'\n');
}
console.log('Generated 20 public About/FAQ pages (all 10 platform languages)');

await import('./build-privacy-information.mjs');

// Keep the approved Chinese About page separate from the shared privacy template.
const zhAboutUrl=new URL('../public/about-zh.html',import.meta.url);
const zhAboutContent="<p>AI CREATOR 是漫剧与短剧作品平台，可浏览故事、参与任务并查看个人记录。</p><p>用户每天可以领取任务。每项任务都有对应的完成条件和佣金，确认前可查看作品、完成条件与完成佣金。请完成当前任务后再领取下一项。</p><p>如果当前还有未处理的任务，请先完成任务后再申请提现。设置资金密码并添加本人银行卡后，可在钱包提交申请并查看处理进度。</p><p>AI CREATOR 是 AI CREATOR HUB LTD 的运营名称。公司注册于英格兰和威尔士，编号 17363119。</p>";
const zhAboutStyles="main{padding:38px 46px}\n.hero{padding-bottom:22px;margin-bottom:24px}\n.hero small{display:block;color:#74518c;font-size:11px;font-weight:700}\narticle>p{max-width:65ch;margin-bottom:18px;line-height:1.85}\n.platform-rules{margin:28px 0 24px;padding:24px 26px;border:1px solid #e9def0;border-radius:16px;background:#faf7fc}\n.platform-rules h2{font-size:1.25rem;line-height:1.4;color:#392b46;margin:0 0 14px}\n.platform-rules ol{margin:0;padding-inline-start:1.65em}\n.platform-rules li{padding-inline-start:.45em;line-height:1.75}\n.platform-rules li::marker{color:#74518c;font-weight:700}\n.platform-rules li+li{margin-top:12px;padding-top:12px;border-top:1px solid #e9def0}\n.platform-rules li strong{display:block;color:#392b46;margin-bottom:2px}\n.footer-nav{padding:16px 0 0;margin-top:24px}\n@media(max-width:600px){main{padding:24px 20px}.hero{margin-bottom:20px}.platform-rules{padding:18px 16px;margin:24px 0 20px}.platform-rules li+li{margin-top:10px;padding-top:10px}}";
const zhAbout=readFileSync(zhAboutUrl,'utf8');
writeFileSync(zhAboutUrl,zhAbout.replace(/<article>.*?<\/article>/,()=>'<article>'+zhAboutContent+'</article>').replace('</style>',()=>zhAboutStyles+'</style>'));

const approvedZhAbout="<article class=\"about-platform\">\n<p class=\"about-intro\">AI CREATOR 是一个提供漫剧与短剧浏览、平台任务及账户管理服务的线上平台。你可以查看作品和故事简介，按需参与任务，并在个人账户中跟进任务与交易记录。</p>\n<section aria-labelledby=\"about-content\">\n<h2 id=\"about-content\">作品与任务</h2>\n<p>作品页面提供漫剧与短剧的故事简介。平台每天开放任务领取，你可以在确认前查看对应作品、完成条件和佣金，再决定是否参与。领取后，可在账户中查看任务进度与历史记录。</p>\n</section>\n<section aria-labelledby=\"about-account\">\n<h2 id=\"about-account\">账户与交易记录</h2>\n<p>你可以在钱包中查看充值和提款记录，并跟进申请处理进度。办理交易前，可通过页尾的「平台交易与使用规则」查看处理时间、提款资料要求及其他使用规则。</p>\n</section>\n<section aria-labelledby=\"about-operator\">\n<h2 id=\"about-operator\">平台运营与支持</h2>\n<p>AI CREATOR 是 AI CREATOR HUB LTD 的运营名称。公司注册于英格兰和威尔士，注册编号为 17363119。</p>\n<p>如有账户、任务或交易相关问题，可查看「常见问题」，也可联系在线客服，或通过页脚「公司信息」中的客服邮箱联系我们。</p>\n</section>\n</article>";
const aboutStyles=".about-platform h2{font-size:1.12rem;line-height:1.4;color:#392b46;margin:0 0 8px}.about-platform .about-intro{font-size:1.03rem}.about-platform section{padding-top:17px;margin-top:17px;border-top:1px solid #eee6f2}.about-platform section p{margin:0 0 10px}.about-platform section p:last-child{margin-bottom:0}";
const rulesUrl=lang=>'/platform-rules-'+lang+'.html';
for(const lang of codes){
 const suffix=lang==='ka'?'':'-'+lang;
 const aboutUrl='/about'+suffix+'.html';
 const aboutFile=new URL('../public'+aboutUrl,import.meta.url);
 const about=readFileSync(aboutFile,'utf8');
 const [title,...rules]=platformRules[lang];
 const list=rules.map(rule=>{
  const [heading,description]=rule.split('|');
  return '<li><strong>'+esc(heading)+'</strong> '+esc(description)+'</li>';
 }).join('');
 const nav=codes.map(code=>{
  const tag=code==='zh'?'zh-SG':code;
  return '<a href="'+rulesUrl(code)+'" lang="'+tag+'" hreflang="'+tag+'"'+(code===lang?' aria-current="page"':'')+'>'+labels[code]+'</a>';
 }).join('');
 const alternates=codes.map(code=>'<link rel="alternate" hreflang="'+(code==='zh'?'zh-SG':code)+'" href="https://aicreatorai.com'+rulesUrl(code)+'">').join('');
 const rulesPage=about
  .replace(/<title>.*?<\/title>/,'<title>'+esc(title)+' · AI CREATOR</title>')
  .replace(/<meta name="description"[^>]*>/,'<meta name="description" content="'+esc(title)+'">')
  .replace(/<link rel="canonical"[^>]*>/,'<link rel="canonical" href="https://aicreatorai.com'+rulesUrl(lang)+'">')
  .replace(/(?:<link rel="alternate"[^>]*>)+/,()=>alternates)
  .replace(/<nav aria-label="Language">.*?<\/nav>/,()=>'<nav aria-label="Language">'+nav+'</nav>')
  .replace(/<h1>.*?<\/h1>/,'<h1>'+esc(title)+'</h1>')
  .replace(/<article>[\s\S]*?<\/article>/,()=>'<article class="rules"><ol>'+list+'</ol></article>')
  .replace('</style>','.rules ol{margin:0;padding-inline-start:1.65em}.rules li{padding-inline-start:.45em;line-height:1.75}.rules li::marker{color:#74518c;font-weight:700}.rules li+li{margin-top:14px;padding-top:14px;border-top:1px solid #e9def0}.rules strong{display:block;color:#392b46}.hero h1{overflow-wrap:anywhere}</style>');
 writeFileSync(new URL('../public'+rulesUrl(lang),import.meta.url),rulesPage);
 const rulesLink='<a href="'+rulesUrl(lang)+'">'+esc(title)+'</a>';

 const localizedArticle=lang==='zh'?approvedZhAbout:(()=>{
  const [intro,taskHeading,tasks,walletHeading,wallet,operatorHeading,operator,support]=aboutLocales[lang];
  return '<article class="about-platform"><p class="about-intro">'+esc(intro)+'</p>'+
   '<section><h2>'+esc(taskHeading)+'</h2><p>'+esc(tasks)+'</p></section>'+
   '<section><h2>'+esc(walletHeading)+'</h2><p>'+esc(wallet)+'</p></section>'+
   '<section><h2>'+esc(operatorHeading)+'</h2><p>'+esc(operator)+'</p><p>'+esc(support)+'</p></section></article>';
 })();
 const updatedAbout=about.replace(/<article>[\s\S]*?<\/article>/,()=>localizedArticle)
  .replace('</style>',()=>aboutStyles+'</style>')
  .replace('<nav class="footer-nav">','<nav class="footer-nav">'+rulesLink);
 writeFileSync(aboutFile,updatedAbout);
}
