import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const info=JSON.parse(readFileSync(new URL('shared/site-information.json',root),'utf8'));
const privacy=JSON.parse(readFileSync(new URL('shared/privacy-information.json',root),'utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const codes=['en','fr','de','es','pt','ka','ru','ar','id','zh'];
const names=['English','Français','Deutsch','Español','Português','ქართული','Русский','العربية','Bahasa Indonesia','zh-CN'];
const tag=k=>k==='zh'?'zh-CN':k;
const url=k=>'https://aicreatorai.com/privacy-'+k+'.html';
for(const k of codes){
 const d=privacy[k],c=info.company,suffix=k==='ka'?'':'-'+k;
 let html=readFileSync(new URL('public/about'+suffix+'.html',root),'utf8');
 html=html.replace(/<title>.*?<\/title>/,`<title>${esc(d.title)} · AI CREATOR</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${esc(d.intro)}">`)
 .replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="${url(k)}">`)
 .replace(/<link rel="alternate"[^>]*>/g,'')
 .replace('</head>',codes.map(l=>`<link rel="alternate" hreflang="${tag(l)}" href="${url(l)}">`).join('')+'<link rel="alternate" hreflang="x-default" href="https://aicreatorai.com/privacy.html"></head>')
 .replace(/<nav aria-label="Language">.*?<\/nav>/,`<nav aria-label="Language">${codes.map((l,i)=>`<a href="/privacy-${l}.html" lang="${tag(l)}" data-language="${tag(l)}" ${l===k?'aria-current="page"':''}>${names[i]}</a>`).join('')}</nav>`)
 .replace(/<h1>.*?<\/h1>/,`<h1>${esc(d.title)}</h1><p>${esc(d.intro)}</p><small style="letter-spacing:0">${esc(d.labels[0])}: <time datetime="2026-11-02">2026-11-02</time></small>`);
 const article=d.sections.map((p,i)=>`<section aria-labelledby="privacy-${i}"><h2 id="privacy-${i}" style="font-size:1.2rem;margin:30px 0 12px">${i+1}. ${esc(d.labels[i+1])}</h2><p>${esc(p)}${i===0?` <a href="mailto:${c.email}">${c.email}</a></p><p>${esc(c.name)} · No. ${esc(c.number)}<br><span dir="ltr">${esc(c.registered)}</span>`:''}${i===7?' <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer">ICO</a>':''}</p></section>`).join('');
 html=html.replace(/<article>.*?<\/article>/,`<article><a href="mailto:${c.email}" style="display:inline-block;padding:10px 16px;background:#f6f0fa;border-radius:12px">${c.email}</a>${article}</article>`);
 html=html.replace(`<a href="/privacy-${k}.html">${esc(d.title)}</a>`,'');
 writeFileSync(new URL('public/privacy-'+k+'.html',root),html);
 if(k==='en'){
  const script=`<script>(()=>{let saved='';try{saved=localStorage.getItem('ai-creator-language-v1')||''}catch{}const supported=${JSON.stringify(codes)};const normal=v=>v.toLowerCase().split('-')[0];const choices=[saved,...(navigator.languages||[navigator.language])];const lang=choices.map(normal).find(x=>supported.includes(x))||'en';if(lang!=='en')location.replace('/privacy-'+lang+'.html'+location.search+location.hash)})();</script>`;
  writeFileSync(new URL('public/privacy.html',root),html.replace('</body>',script+'</body>'));
 }
}
const sitemapFile=new URL('public/sitemap.xml',root);
let sitemap=readFileSync(sitemapFile,'utf8').replace(/<url><loc>https:\/\/aicreatorai\.com\/privacy[^<]*<\/loc>[\s\S]*?<\/url>\s*/g,'');
const alternates=codes.map(k=>`<xhtml:link rel="alternate" hreflang="${tag(k)}" href="${url(k)}"/>`).join('')+'<xhtml:link rel="alternate" hreflang="x-default" href="https://aicreatorai.com/privacy.html"/>';
const entries=[...codes.map(url),'https://aicreatorai.com/privacy.html'].map(u=>`<url><loc>${u}</loc><lastmod>2026-11-02</lastmod>${alternates}</url>`).join('\n');
writeFileSync(sitemapFile,sitemap.replace('</urlset>',entries+'\n</urlset>'));
console.log('Generated ten localized privacy pages, language-aware public entry and sitemap links');

const {gzipSync,brotliCompressSync}=await import('node:zlib');
const sitemapBytes=readFileSync(sitemapFile);
writeFileSync(new URL('public/sitemap.xml.gz',root),gzipSync(sitemapBytes));
writeFileSync(new URL('public/sitemap.xml.br',root),brotliCompressSync(sitemapBytes));
