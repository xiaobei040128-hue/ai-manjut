import {test,expect} from '@playwright/test';
test('three-stage production workflow uses server amounts and one ledger settlement',async({page,browser})=>{
 const call=async(path:string,body?:unknown)=>{const r=body===undefined?await page.request.get('/api'+path):await page.request.post('/api'+path,{data:body,headers:{'X-Workspace-Request':'1'}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
 await call('/admin/setup',{username:'finance-e2e',password:'FinanceBrowserQA123!'});
 expect((await call('/admin/bootstrap')).wallet.available).toBe(0);
 expect((await call('/tasks')).tasks).toHaveLength(0);
 await call('/admin/commission-policy',{rate:'5'});
 const tasks=[];for(const stage of [1,2,3])tasks.push(await call('/tasks',{stage,premium:stage===3,title:'阶段 '+stage+' 作品任务',description:'发布一条作品并提供截图',platform:'TikTok',language:'中文',genre:'剧情',deposit:100*stage,posts:1,episodes:1,slots:10,cover:'/art/hero-v2.webp'}));
 const invite=await call('/admin/invitations',{});
 await call('/auth/register',{email:'finance-browser@example.invalid',password:'FinanceBrowserQA123!',inviteCode:invite.code});
 const deposit=await call('/finance/requests',{kind:'deposit',amount:'500',reference:'Isolated-E2E-Receipt',operationKey:'finance-browser-deposit-0001'});
 await call('/admin/finance/fund/'+deposit.id+'/review',{decision:'approve',confirmReceived:true});
 const other=await browser.newContext();expect((await other.request.get('http://127.0.0.1:4191/api/admin/commission-policy')).status()).toBe(401);await other.close();
 const agent=await call('/admin/agents',{username:'finance-agent',password:'FinanceBrowserQA123!'});
 const agentContext=await browser.newContext();await agentContext.request.post('http://127.0.0.1:4191/api/admin/login',{data:{username:agent.username,password:'FinanceBrowserQA123!'},headers:{'X-Workspace-Request':'1'}});
 expect((await agentContext.request.post('http://127.0.0.1:4191/api/admin/commission-policy',{data:{rate:'99'},headers:{'X-Workspace-Request':'1'}})).status()).toBe(403);await agentContext.close();
 await page.goto('/?view=app&design=newcomer');await expect(page.getByRole('heading',{name:'第 1 阶段任务'})).toBeVisible();
 await page.getByRole('button',{name:'冻结 $100.00 并领取',exact:true}).click({force:true});await expect(page).toHaveURL(/assignment=/);
 let assignment=(await call('/bootstrap')).assignments[0];expect(assignment.task.commission).toBe(500);expect((await call('/bootstrap')).wallet.available).toBe(40000);
 await call('/admin/commission-policy',{rate:'10'});
 async function complete(a:{id:string}){const image=await call('/assignments/'+a.id+'/uploads',{name:'proof.png',data:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(20)]).toString('base64')});await call('/assignments/'+a.id+'/submit',{links:['https://example.invalid/e2e/'+a.id],uploadIds:[image.id]});await call('/assignments/'+a.id+'/review',{decision:'approve'});await call('/assignments/'+a.id+'/review',{decision:'approve'});}
 await complete(assignment);expect((await call('/bootstrap')).wallet.available).toBe(50500);
 await page.goto('/?view=app&design=advanced');await page.getByRole('button',{name:'冻结 $200.00 并领取',exact:true}).click({force:true});await expect(page).toHaveURL(/assignment=/);
 assignment=(await call('/bootstrap')).assignments.find((a:{task:{stage:number}})=>a.task.stage===2);expect(assignment.task.commission).toBe(2000);await complete(assignment);expect((await call('/bootstrap')).wallet.available).toBe(52500);
 await page.goto('/?view=app&design=third');await expect(page.getByRole('button',{name:'申请报名',exact:true})).toBeVisible();
 let releaseEnrollment!:()=>void,captureEnrollment!:()=>void;
 const heldEnrollment=new Promise<void>(resolve=>{releaseEnrollment=resolve;}),capturedEnrollment=new Promise<void>(resolve=>{captureEnrollment=resolve;});
 await page.route('**/api/stage-three/enrollment',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch();captureEnrollment();await heldEnrollment;await route.fulfill({response});});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await capturedEnrollment;
 await page.getByRole('button',{name:'申请报名',exact:true}).click({force:true});await expect(page.getByText('等待平台审核',{exact:true})).toBeVisible();
 releaseEnrollment();await page.unrouteAll({behavior:'wait'});await expect(page.getByText('等待平台审核',{exact:true})).toBeVisible();
 const dispatch=await call('/admin/premium-dispatch');const customer=dispatch.customers.find((c:{email:string})=>c.email==='finance-browser@example.invalid');await call('/admin/premium-dispatch/'+customer.id,{day:dispatch.day,revision:customer.revision,sequences:[1,3]});
 const scoped=await browser.newContext();await scoped.request.post('http://127.0.0.1:4191/api/admin/login',{data:{username:agent.username,password:'FinanceBrowserQA123!'},headers:{'X-Workspace-Request':'1'}});expect((await (await scoped.request.get('http://127.0.0.1:4191/api/admin/premium-dispatch')).json()).customers).toHaveLength(0);expect((await scoped.request.post('http://127.0.0.1:4191/api/admin/premium-dispatch/'+customer.id,{data:{day:dispatch.day,revision:1,sequences:[2]},headers:{'X-Workspace-Request':'1'}})).status()).toBe(403);await scoped.close();
 const enrollment=(await call('/admin/stage-enrollments')).enrollments[0];await call('/admin/stage-enrollments/'+enrollment.id+'/review',{decision:'approve'});
 await page.goto('/?view=app&design=third');await page.getByRole('button',{name:'冻结 $300.00 并领取',exact:true}).click({force:true});await expect(page.getByRole('dialog')).toBeVisible();await page.screenshot({path:'../visual-premium-reveal.png',animations:'disabled'});await page.setViewportSize({width:740,height:360});await page.getByRole('button',{name:'开启高阶创作 →'}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'开启高阶创作 →'})).toBeInViewport();await page.setViewportSize({width:320,height:568});await page.getByRole('button',{name:'开启高阶创作 →'}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'开启高阶创作 →'})).toBeInViewport();await page.screenshot({path:'../visual-premium-small-screen.png',animations:'disabled'});await page.setViewportSize({width:430,height:920});await page.getByRole('button',{name:'开启高阶创作 →'}).click();await expect(page).toHaveURL(/assignment=/);
 assignment=(await call('/bootstrap')).assignments.find((a:{task:{stage:number}})=>a.task.stage===3);await call('/assignments/'+assignment.id+'/cancel',{});await call('/assignments/'+assignment.id+'/cancel',{});
 const final=await call('/bootstrap');expect(final.wallet.available).toBe(52500);expect(final.wallet.held).toBe(0);expect(final.wallet.earned).toBe(2500);
 const q=await call('/tasks/'+tasks[2].id),claimThird=()=>call('/assignments',{taskId:q.id,expected:{amount:q.deposit,commission:q.commission,rateBps:q.commission_rate_bps}});
 const ordinary=await claimThird();expect(ordinary.task.premium).toBe(0);expect(ordinary.task.dispatch_sequence).toBe(2);await call('/assignments/'+ordinary.id+'/cancel',{});
 const repeated=await claimThird();expect(repeated.task.premium).toBe(1);expect(repeated.task.dispatch_sequence).toBe(3);await complete(repeated);expect((await call('/bootstrap')).wallet.available).toBe(55500);
 await page.goto('/?view=app&design=third');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog')).toContainText('佣金已到账');await page.screenshot({path:'../visual-premium-settled.png',animations:'disabled'});await page.getByRole('button',{name:'查看任务记录 →'}).click();await expect(page).toHaveURL(/assignment=/);
 expect((await page.request.post('/api/stage-three/example',{data:{source:'demo',balance:'500'},headers:{'X-Workspace-Request':'1'}})).status()).toBe(410);
 await page.goto('/?view=app&design=third');await expect(page.getByRole('heading',{name:'第 3 阶段任务'})).toBeVisible();await page.screenshot({path:'../stage-finance-verified.png',fullPage:true});
 for(const route of ['home','wallet','notices','profile','hall','discover','saved']){
  await page.goto('/?view=app&page='+route);await expect(page.locator('.s-header')).toBeVisible();await expect(page.locator('.s-skeleton')).toHaveCount(0);await expect(page.locator('.s-main')).toHaveCSS('opacity','1');await page.locator('.s-header').click({position:{x:10,y:10},force:true});await page.screenshot({path:'../visual-'+route+'.png',fullPage:true,animations:'disabled'});
 }
 await page.goto('/admin#commission');await expect(page.getByRole('heading',{name:'三个阶段统一佣金比例'})).toBeVisible();await page.screenshot({path:'../visual-admin.png',fullPage:true});
 await page.goto('/admin#enrollments');await expect(page.getByRole('heading',{name:'客户高阶任务派发'})).toBeVisible();await page.getByRole('button',{name:'设置触发序号'}).click();await expect(page.getByRole('checkbox',{name:'第 1 单',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'第 3 单',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'第 1 单',exact:true})).toBeDisabled();await page.screenshot({path:'../visual-dispatch-settings.png',animations:'disabled'});
});
