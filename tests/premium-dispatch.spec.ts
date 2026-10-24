import {test,expect} from '@playwright/test';
test('per-customer dispatch saves canonical state and recovers from concurrent changes',async({page,browser})=>{
 const post=async(path:string,data:unknown)=>{const response=await page.request.post('/api'+path,{data,headers:{'X-Workspace-Request':'1'}});expect(response.ok(),await response.text()).toBeTruthy();return response.json();};
 await post('/admin/setup',{username:'dispatch-browser',password:'DispatchBrowserQA123!'});
 const invite=await post('/admin/invitations',{});
 for(const email of ['dispatch-first@example.invalid','dispatch-second@example.invalid'])await post('/auth/register',{email,password:'DispatchBrowserQA123!',inviteCode:invite.code});
 const read=async()=> (await page.request.get('/api/admin/premium-dispatch')).json();
 const initial=await read(),first=initial.customers.find((c:{email:string})=>c.email==='dispatch-first@example.invalid');
 await page.goto('/admin#enrollments');
 const panel=page.locator('section.ad-panel').filter({has:page.getByRole('heading',{name:'客户高阶任务派发'})});
 const row=panel.getByRole('row').filter({hasText:'dispatch-first@example.invalid'});
 await row.getByRole('button',{name:'设置触发序号'}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('checkbox',{name:'第 1 单',exact:true}).check();await dialog.getByRole('checkbox',{name:'第 3 单',exact:true}).check();
 // A successful save must not turn into a failure because a follow-up list read fails.
 await page.route('**/api/admin/premium-dispatch',route=>route.abort());
 await dialog.getByRole('button',{name:'保存当前客户配置'}).click();
 await expect(dialog).toHaveCount(0);await expect(panel.getByRole('status')).toContainText('已保存');
 await expect(row).toContainText('第 1 单、第 3 单');await expect(panel.getByRole('alert')).toHaveCount(0);
 await page.unroute('**/api/admin/premium-dispatch');
 await row.getByRole('button',{name:'设置触发序号'}).click();
 const other=await browser.newContext({baseURL:'http://127.0.0.1:4193'});
 await other.request.post('/api/admin/login',{data:{username:'dispatch-browser',password:'DispatchBrowserQA123!'},headers:{'X-Workspace-Request':'1'}});
 const current=await read(),record=current.customers.find((c:{id:string})=>c.id===first.id);
 const changed=await other.request.post('/api/admin/premium-dispatch/'+first.id,{data:{day:current.day,revision:record.revision,sequences:[2]},headers:{'X-Workspace-Request':'1'}});expect(changed.ok()).toBeTruthy();
 await dialog.getByRole('checkbox',{name:'第 5 单',exact:true}).check();await dialog.getByRole('button',{name:'保存当前客户配置'}).click();
 await expect(dialog.getByRole('alert')).toContainText('其他页面更新');
 await dialog.getByRole('button',{name:'重新读取配置（覆盖未保存选择）'}).click();
 await expect(dialog.getByRole('checkbox',{name:'第 2 单',exact:true})).toBeChecked();await expect(dialog.getByRole('checkbox',{name:'第 1 单',exact:true})).not.toBeChecked();
 await dialog.getByRole('checkbox',{name:'第 5 单',exact:true}).check();
 await page.screenshot({path:'../visual-admin-dispatch.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'保存当前客户配置'}).click();await expect(dialog).toHaveCount(0);await expect(row).toContainText('第 2 单、第 5 单');
 const final=await read();expect(final.customers.find((c:{id:string})=>c.id===first.id).sequences).toEqual([2,5]);expect(final.customers.find((c:{id:string})=>c.id!==first.id).sequences).toEqual([]);
 await row.getByRole('button',{name:'设置触发序号'}).click();await dialog.getByRole('button',{name:'关闭所有未触发位置'}).click();await dialog.getByRole('button',{name:'保存当前客户配置'}).click();await expect(dialog).toHaveCount(0);await expect(row).toContainText('未设置 · 不触发');
 await other.close();
});

test('commission editor preserves server changes on conflict and supports explicit reload',async({page})=>{
 const post=async(path:string,data:unknown)=>{const r=await page.request.post('/api'+path,{data,headers:{'X-Workspace-Request':'1'}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
 await post('/admin/login',{username:'dispatch-browser',password:'DispatchBrowserQA123!'});
 const original=await(await page.request.get('/api/admin/commission-policy')).json();await post('/admin/commission-policy',{rate:'5',revision:original.revision});
 await page.goto('/admin#commission');const input=page.getByRole('spinbutton',{name:'佣金比例（%）'});await expect(input).toHaveValue('5');
 const current=await(await page.request.get('/api/admin/commission-policy')).json();await post('/admin/commission-policy',{rate:'8.5',revision:current.revision});
 await input.fill('12');await page.getByRole('button',{name:'保存统一比例'}).click();await expect(page.getByRole('alert')).toContainText('其他页面更新');
 expect((await(await page.request.get('/api/admin/commission-policy')).json()).rate_bps).toBe(850);
 await page.getByRole('button',{name:'重新读取比例'}).click();await expect(input).toHaveValue('8.5');await input.fill('7.25');await page.getByRole('button',{name:'保存统一比例'}).click();await expect(page.getByRole('status')).toContainText('佣金比例已保存');
 expect((await(await page.request.get('/api/admin/commission-policy')).json()).rate_bps).toBe(725);
});

test('successful deposit approval remains confirmed when list refresh fails',async({page})=>{
 const post=async(path:string,data:unknown)=>{const r=await page.request.post('/api'+path,{data,headers:{'X-Workspace-Request':'1'}});expect(r.ok(),await r.text()).toBeTruthy();return r.json();};
 await post('/admin/login',{username:'dispatch-browser',password:'DispatchBrowserQA123!'});
 const invite=await post('/admin/invitations',{});await post('/auth/register',{email:'finance-refresh@example.invalid',password:'DispatchBrowserQA123!',inviteCode:invite.code});
 const deposit=await post('/finance/requests',{kind:'deposit',amount:'9.75',reference:'finance-refresh-confirmed',operationKey:'finance-refresh-confirmed-001'});
 await page.goto('/admin#finance');await page.getByRole('button',{name:/充值审批/}).click();
 const row=page.getByRole('row').filter({hasText:'finance-refresh@example.invalid'});await row.getByRole('button',{name:'审核通过',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'我已在外部核实实际收款，同意入账'}).check();
 await page.route('**/api/admin/finance',route=>route.abort());await dialog.getByRole('button',{name:'确认保存'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByText('操作已保存。',{exact:true})).toBeVisible();await expect(page.getByText('操作已保存，但列表暂未刷新。请刷新核对最新记录，无需重复提交。',{exact:true})).toBeVisible();
 const snapshot=await(await page.request.get('/api/finance')).json();expect(snapshot.requests.find((r:{id:string})=>r.id===deposit.id).status).toBe('completed');
 await page.unroute('**/api/admin/finance');await page.getByRole('button',{name:'刷新',exact:true}).click();await expect(row).toContainText('已到账');await expect(row.getByRole('button',{name:'审核通过',exact:true})).toHaveCount(0);
});
