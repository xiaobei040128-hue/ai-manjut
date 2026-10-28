import {test,expect} from '@playwright/test';
import {readFileSync,appendFileSync} from 'node:fs';
const states=JSON.parse(readFileSync('tests/fixtures/full-stage-matrix.json','utf8'));
const languages=['en','fr','de','es','pt','ka','ru','ar','id','zh-SG'];
const out='C:/Users/ADMIN/Documents/Codex/2026-10-27/new-chat/outputs/客户全状态复查';
for(const width of [320,390])test(`journey live switching ${width}: 33 states across ten languages`,async({page,context})=>{
 test.setTimeout(180000);await page.setViewportSize({width,height:width===320?568:844});let state=states[0];
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;await route.fulfill({json:p==='/api/stage-finance'?state.data:p==='/api/stage-journey/identity-reward'?{show:false}:p.startsWith('/api/stage-journey')?{...state.data.journey,rewards:[]}:p==='/api/stage-three/enrollment'?state.enrollment:p==='/api/stage-three/access'?state.access||{}:{}});});
 const controller=await context.newPage();await controller.goto('/tests/animation-audit.html?view=app');
 for(const current of states){state=current;await page.goto('/tests/localization-finance.html?view=app&fixture=stage&stage='+current.stage);await expect(page.locator('.stage-work')).toBeVisible();if(current.stage===2)await expect(page.locator('.journey-community-task')).toBeVisible();else await expect(page.locator('.stage-work header h1')).toBeVisible();
 for(const language of languages){await controller.locator('.language-selector select').selectOption(language);await expect(page.locator('html')).toHaveAttribute('lang',language);const r=await page.locator('.stage-work').evaluate(e=>({text:(e as HTMLElement).innerText,overflow:document.documentElement.scrollWidth>innerWidth+2}));expect(r.overflow,current.label+' '+language).toBe(false);if(language!=='zh-SG')expect(r.text,current.label+' '+language).not.toMatch(/[\u3400-\u9fff]/);appendFileSync(out+'/任务切换观察.jsonl',JSON.stringify({state:current.label,language,width,...r})+'\n');}
 }await controller.close();
});
