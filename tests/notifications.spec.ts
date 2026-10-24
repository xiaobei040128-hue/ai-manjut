import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';

test('financial notices route to wallet, paginate, recover from failures and remain account isolated',async({page,browser})=>{
 const post=async(path:string,input:unknown)=>{const r=await page.request.post('/api'+path,{data:input,headers:{'X-Workspace-Request':'1'}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
 await post('/admin/setup',{username:'notification-admin',password:'NotificationQA123!'});
 const invite=await post('/admin/invitations',{});
 await post('/auth/register',{email:'notification-a@example.invalid',password:'NotificationQA123!',inviteCode:invite.code});
 const request=await post('/finance/requests',{kind:'deposit',amount:'12.50',reference:'notification-deposit-1',operationKey:randomUUID()});
 await post('/admin/finance/fund/'+request.id+'/review',{decision:'approve',confirmReceived:true});
 const other=await browser.newContext({baseURL:'http://127.0.0.1:4192'});const registered=await other.request.post('/api/auth/register',{data:{email:'notification-b@example.invalid',password:'NotificationQA123!',inviteCode:invite.code},headers:{'X-Workspace-Request':'1'}});expect(registered.ok()).toBeTruthy();
 expect((await(await other.request.get('/api/notifications')).json()).unreadCount).toBe(0);
 for(const url of ['/api/notifications?limit=0','/api/notifications?before=-1','/api/notifications?unread=true'])expect((await page.request.get(url)).status()).toBe(400);
 await page.goto('/?view=app&page=notices');await expect(page.getByRole('heading',{name:'每一份进展，都有回音'})).toBeVisible();await expect(page.getByText('2 条未读消息',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/充值已到账/}).click({force:true});await expect(page).toHaveURL(/page=wallet/);expect((await(await page.request.get('/api/notifications')).json()).unreadCount).toBe(1);
 await Promise.all(Array.from({length:45},(_,n)=>post('/finance/requests',{kind:'deposit',amount:'1',reference:'pagination-'+n,operationKey:randomUUID()})));
 await page.goto('/?view=app&page=notices');await expect(page.locator('.s-notice-card')).toHaveCount(20);await expect(page.getByText('46 条未读消息',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'加载更早消息'}).click({force:true});await expect(page.locator('.s-notice-card')).toHaveCount(40);await page.getByRole('button',{name:'加载更早消息'}).click({force:true});await expect(page.locator('.s-notice-card')).toHaveCount(47);await expect(page.getByRole('button',{name:'加载更早消息'})).toHaveCount(0);
 await page.route('**/api/notifications/*/read',route=>route.abort());
 await page.locator('.s-notice-card').first().click({force:true});await expect(page.getByRole('alert')).toBeVisible();await expect(page).toHaveURL(/page=notices/);expect((await(await page.request.get('/api/notifications')).json()).unreadCount).toBe(46);await page.unroute('**/api/notifications/*/read');
 let releaseNotices!:()=>void,captureNotices!:()=>void;
 const delayedNotices=new Promise<void>(resolve=>{releaseNotices=resolve;}),capturedNotices=new Promise<void>(resolve=>{captureNotices=resolve;});
 await page.route('**/api/notifications?*',async route=>{const response=await route.fetch();captureNotices();await delayedNotices;await route.fulfill({response});});
 await page.getByRole('button',{name:'刷新通知'}).click();await capturedNotices;
 const markAll=page.getByRole('button',{name:/全部已读/}).click({force:true});
 // The mutation must invalidate a previously started read before that old response arrives.
 await expect.poll(async()=> (await(await page.request.get('/api/bootstrap')).json()).notificationsUnread).toBe(0);
 releaseNotices();await markAll;await page.unrouteAll({behavior:'wait'});
await expect(page.getByText('0 条未读消息',{exact:true})).toBeVisible();await page.getByRole('button',{name:'未读',exact:true}).click({force:true});await expect(page.getByRole('heading',{name:'未读消息已处理完'})).toBeVisible();
 expect((await(await other.request.get('/api/notifications')).json()).unreadCount).toBe(0);
 await page.screenshot({path:'../upgrade-notifications-empty.png',animations:'disabled'});await other.close();
});

test('a delayed session response cannot restore an expired creator session',async({page})=>{
 const post=async(path:string,data:unknown)=>{const r=await page.request.post('/api'+path,{data,headers:{'X-Workspace-Request':'1'}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
 await post('/admin/login',{username:'notification-admin',password:'NotificationQA123!'});
 const invite=await post('/admin/invitations',{});
 await post('/auth/register',{email:'session-race@example.invalid',password:'NotificationQA123!',inviteCode:invite.code});
 await page.goto('/?view=app&page=notices');
 await expect(page.getByRole('heading',{name:'每一份进展，都有回音'})).toBeVisible();
 let release!:()=>void,received!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 const captured=new Promise<void>(resolve=>{received=resolve;});
 await page.route('**/api/auth/session',async route=>{const response=await route.fetch();received();await held;await route.fulfill({response});});
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await captured;
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('creator-session-expired',{detail:'测试登录失效'})));
 await expect(page.getByRole('button',{name:'登录创作者账号'})).toBeVisible();
 release();
 await page.unrouteAll({behavior:'wait'});
 await expect(page.getByRole('button',{name:'登录创作者账号'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'每一份进展，都有回音'})).toHaveCount(0);
});
