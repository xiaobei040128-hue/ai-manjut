import test from 'node:test';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {coverImage} from '../src/cover-images.ts';

test('all catalog originals remain available, optimized variants are versioned WebP and reduce transfer',()=>{
 const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url)));
 let original=0,display=0,thumbnail=0;
 for(const s of stories){
  original+=statSync(new URL('../public'+s.cover,import.meta.url)).size;
  for(const size of ['display','thumbnail']){
   const path=coverImage(s.cover,size);assert.match(path,/^\/assets\/cover-.+-[a-f0-9]{12}\.webp$/);
   const bytes=readFileSync(new URL('../public'+path,import.meta.url));
   assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
   assert.ok(bytes.length<250000,`${size} exceeds budget: ${s.title}`);
   if(size==='display')display+=bytes.length;else thumbnail+=bytes.length;
  }
 }
 assert.ok(display<original*.15);assert.ok(thumbnail<display*.5);
});
test('custom uploads, unknown covers and download paths are not rewritten',()=>{
 for(const path of ['/uploads/customer-cover.png','https://example.invalid/custom.webp','/stories/future.png',''])assert.equal(coverImage(path),path);
 const source=readFileSync(new URL('../src/Prototype.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('href={task.cover} download='));
});

import {taskCoverPreview} from '../server/task-covers.mjs';
const cacheSource=readFileSync(new URL('../src/studio/task-cover-cache.ts',import.meta.url),'utf8').replace("'../cover-images'",JSON.stringify(new URL('../src/cover-images.ts',import.meta.url).href));
const {prepareTaskCover,taskCoverSource,knownTaskCover,forgetTaskCover}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(cacheSource)).toString('base64'));
test('response cover previews match every original work exactly and never read arbitrary paths',async()=>{
 const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
 for(const story of stories){const preview=taskCoverPreview(story.cover);assert.ok(preview,story.cover);assert.equal(preview.source,story.cover);const bytes=Buffer.from(preview.dataUri.split(',')[1],'base64');assert.deepEqual(bytes,readFileSync(new URL('../public'+coverImage(story.cover,'thumbnail'),import.meta.url)));assert.equal(taskCoverPreview(story.cover,story.cover),null);}
 for(const path of ['../../runtime-data/finance.key','/api/admin/bootstrap','https://example.invalid/cover.webp','/art/unknown.webp'])assert.equal(taskCoverPreview(path),null);
 const preview=taskCoverPreview(stories[0].cover);await prepareTaskCover(preview);assert.equal(taskCoverSource(preview.source),preview.dataUri);assert.equal(knownTaskCover(preview.source),preview.source);forgetTaskCover(preview.source);assert.equal(knownTaskCover(preview.source),'');assert.equal(taskCoverSource(preview.source),coverImage(preview.source,'thumbnail'));
 await prepareTaskCover({source:preview.source,dataUri:'data:text/html,unsafe'});assert.equal(knownTaskCover(preview.source),'');
});
