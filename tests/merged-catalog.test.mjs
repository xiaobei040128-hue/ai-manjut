import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {createStore} from '../server/store.mjs';import {syncStoryTasks} from '../server/sync-story-tasks.mjs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url)));
const added=['The Lawyer Who Never Lost','Midnight Train to Nowhere','The Girl from Floor 99'];
test('204 unique works include all three former-stage works, their original covers and nine existing translations',()=>{
 assert.equal(stories.length,204);assert.equal(new Set(stories.map(s=>s.id )).size,204);assert.equal(new Set(stories.map(s=>s.title )).size,204);
 for(const title of added){const s=stories.find(s=>s.title===title);assert.ok(s);assert.ok(existsSync(new URL('../public'+s.cover,import.meta.url)));
 for(const lang of ['en','fr','de','es','pt','ka','ru','ar','id']){const dict=JSON.parse(readFileSync(new URL('../src/i18n/locales/'+lang+'.json',import.meta.url)));assert.ok(dict[s.description],lang+' description '+title);assert.ok(dict[s.genre],lang+' genre '+title);}}
});
test('startup sync inserts three stage-3 works once, retains configured terms and creates a unique 50-work round',()=>{
 const s=createStore(':memory:');try{
 for(const story of stories.filter(s=>!added.includes(s.title)))s.createTask({...story,stage:3,platform:'TikTok',language:'英文',deposit:'100',commission:'5',posts:1,episodes:1});
 const before=s.db.prepare('SELECT * FROM tasks ORDER BY id').all();assert.equal(before.length,201);syncStoryTasks(s);syncStoryTasks(s);
 const tasks=s.allTasks();assert.equal(tasks.length,204);for(const t of before)assert.deepEqual(s.db.prepare('SELECT * FROM tasks WHERE id=?').get(t.id),t);
 for(const title of added){const task=tasks.find(t=>t.title===title);assert.equal(task.stage,3);assert.equal(task.active,1);}
 s.asUser('qa-merge',()=>s.dispatchStatus());const pool=s.db.prepare("SELECT DISTINCT story_id FROM third_plan_items WHERE owner_id='qa-merge'").all();assert.equal(pool.length,50);
 }finally{s.close();}
});
