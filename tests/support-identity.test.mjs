import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportUrl} from '../src/studio/support-identity.ts';
const base='https://chat.aicreatorai.com/c/8e554736eb8e4e10bd5e6fffc5b4d723';
const alice={id:'1052d3ea-full-id',name:'名字 & + ქართული',email:'qa+alice@example.invalid'};
test('all ten languages preserve identity and apply supported UI language',()=>{
  for(const lang of ['en','fr','de','es','pt','ka','ru','ar','id','zh-SG']){
    const url=new URL(supportUrl(base,alice,lang));
    const user=JSON.parse(url.searchParams.get('user'));
    assert.equal(user.userId,alice.id);assert.equal(user.email,alice.email);
    assert.equal(user.userName,'1052D3EA');
    assert.ok(!JSON.stringify(user).includes(alice.name));
    assert.equal(JSON.parse(url.searchParams.get('config')).language,lang==='ka'?'en':lang==='zh-SG'?'zh':lang);
  }
});
test('switching accounts replaces prior identity and unauthenticated links stay anonymous',()=>{
  const previous=supportUrl(base,alice,'en');
  const next=supportUrl(previous,{id:'bob',name:'Bob',email:'bob@example.invalid'},'fr');
  assert.equal(JSON.parse(new URL(next).searchParams.get('user')).userId,'bob');
  assert.ok(!next.includes('alice'));assert.equal(supportUrl(base,undefined,'en'),base);
});
test('unrelated or unsafe destinations never receive customer details',()=>{
  for(const url of ['https://example.com/contact','https://chat.aicreatorai.com.evil.invalid/c/8e554736eb8e4e10bd5e6fffc5b4d723',base.replace('https:','http:'),'javascript:alert(1)','broken'])assert.equal(supportUrl(url,alice,'en'),url);
});
