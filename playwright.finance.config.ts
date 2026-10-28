import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export default defineConfig({
 testDir:'./tests',workers:1,timeout:60000,
 use:{viewport:{width:430,height:920},reducedMotion:'reduce'},
 projects:[
  {name:'finance',testMatch:'stage-finance.spec.ts',use:{baseURL:'http://127.0.0.1:4191'}},
  {name:'dispatch',testMatch:'premium-dispatch.spec.ts',use:{baseURL:'http://127.0.0.1:4193'}},
  {name:'notifications',testMatch:'notifications.spec.ts',use:{baseURL:'http://127.0.0.1:4192'}},
 ],
 webServer:[4191,4192,4193].map(port=>({command:'node server/index.mjs --production --port '+port,url:'http://127.0.0.1:'+port+'/api/health',reuseExistingServer:false,env:{DRAMA_DATA_DIR:resolve('work/e2e-'+port+'-'+randomUUID())}})),
});
