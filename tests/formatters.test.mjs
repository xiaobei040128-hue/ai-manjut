import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatMoney,formatDate} from '../src/formatters.ts';
test('reused formatters preserve all ten locales, negative money, cents and full dates',()=>{
 for(const locale of ['en-US','fr-FR','de-DE','es-ES','pt-PT','ka-GE','ru-RU','ar-EG','id-ID','zh-SG']){
  for(const n of [0,1,-100,188,100000001])assert.equal(formatMoney(n,locale),new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100));
  for(const full of [false,true])assert.equal(formatDate('2026-10-28T05:01:00Z',full,locale),new Intl.DateTimeFormat(locale,{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(full?{year:'numeric'}:{})}).format(new Date('2026-10-28T05:01:00Z')));
 }
});

import {customerMessage} from '../src/studio/customer-messages.ts';
test('customer feedback removes operational rules and keeps actionable validation',()=>{
 for(const raw of ['可用余额不足，暂无法按比例派单','后台配置未完成','SQLITE_ERROR: missing table','派发配置无效'])assert.equal(customerMessage(raw),'暂时无法完成操作，请联系客服');
 for(const raw of ['登录已过期，请重新登录','请先完成当前任务','密码错误','请求超时，结果可能已保存；请先刷新核对，避免重复提交'])assert.equal(customerMessage(raw),raw);
});

import {createTaskRowCache} from '../src/studio/task-view-state.ts';
test('task refreshes retain unchanged rows while preserving changes, order, removals and account isolation',()=>{
 const reuse=createTaskRowCache();const a={id:'a',owner_id:'one',status:'active',task:{title:'A',deposit:100,commission:2}},b={id:'b',owner_id:'one',status:'completed',task:{title:'B',deposit:200,commission:4}};
 const first=reuse([a,b]);assert.equal(reuse(JSON.parse(JSON.stringify(first))),first);
 for(const change of [{status:'completed'},{task:{...a.task,commission:3}},{task:{...a.task,deposit:101}},{task:{...a.task,title:'Updated'}}]){const altered={...a,...change},next=reuse([altered,JSON.parse(JSON.stringify(b))]);assert.notEqual(next[0],a);assert.equal(next[1],b);assert.deepEqual(next[0],altered);}
 const reordered=reuse([b,a]);assert.deepEqual(reordered.map(x=>x.id),['b','a']);assert.equal(reordered[0],b);assert.deepEqual(reuse([a]).map(x=>x.id),['a']);assert.equal(reuse([]).length,0);
 const other=reuse([{...a,id:'other',owner_id:'two'}]);assert.equal(other[0].owner_id,'two');assert.notEqual(other[0],a);
});
