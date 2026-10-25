import {readFileSync} from 'node:fs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
const lawyer=JSON.parse(readFileSync(new URL('./newcomer-artwork.json',import.meta.url),'utf8'));
// Extend configured catalogs using their existing commercial settings; never rewrite orders or terms.
export function syncStoryTasks(store){
 const tasks=store.allTasks();
 const third=tasks.find(t=>t.stage===3&&stories.some(s=>s.title===t.title));
 const first=tasks.find(t=>t.stage===1);
 for(const [stage,template,entries] of [[3,third,stories],[1,first,[lawyer]]]){
  if(!template)continue;
  for(const story of entries){
   if(tasks.some(t=>t.stage===stage&&t.title===story.title))continue;
   store.createTask({...template,...story,id:undefined,stage,deposit:(template.deposit/100).toFixed(2),commission:(template.commission/100).toFixed(2),episodes:1,posts:1,slots:template.slots});
  }
 }
}
