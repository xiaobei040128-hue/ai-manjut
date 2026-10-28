import {readdir,readFile} from 'node:fs/promises';
const root='dist/client/assets',forbidden=/CreativePlanner|creative-planner|创作工作室|创作者工作室/;
for(const name of await readdir(root)){if(!name.endsWith('.js'))continue;if(forbidden.test(await readFile(root+'/'+name,'utf8')))throw new Error('Removed creator workshop found in client build: '+name);}
console.log('Retired feature check passed: creator workshop is absent from the client build.');
