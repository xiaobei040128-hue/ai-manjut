import {readFileSync} from 'node:fs';
const stories=JSON.parse(readFileSync(new URL('../src/studio/storyCatalog.json',import.meta.url),'utf8'));
const lawyer=JSON.parse(readFileSync(new URL('./newcomer-artwork.json',import.meta.url),'utf8'));
// Seed current artwork on an empty installation; preserve configured tasks and all order terms.
export function syncStoryTasks(store){
 const tasks=store.allTasks();
 const third=tasks.find(t=>t.stage===3&&stories.some(s=>s.title===t.title));
 const first=tasks.find(t=>t.stage===1);
 for(const [stage,template,entries] of [[3,third,stories]]){
  const base=template||{platform:'TikTok',language:'英文',deposit:stage===1?188:20000,commission:0,slots:100,genre:'',description:'',cover:''};
  for(const story of entries){
   if(tasks.some(t=>t.stage===stage&&t.title===story.title))continue;
   store.createTask({...base,...story,premium:story.orderType==='premium',id:undefined,stage,deposit:(base.deposit/100).toFixed(2),commission:(base.commission/100).toFixed(2),episodes:1,posts:1,slots:base.slots});
  }
 }
}

