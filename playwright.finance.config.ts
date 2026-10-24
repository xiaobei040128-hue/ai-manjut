import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
export default defineConfig({testDir:'./tests',testMatch:'stage-finance.spec.ts',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:4191',viewport:{width:430,height:920},reducedMotion:'reduce'},webServer:{command:'node server/index.mjs --production --port 4191',url:'http://127.0.0.1:4191/api/health',reuseExistingServer:false,env:{DRAMA_DATA_DIR:resolve('work/finance-e2e-'+randomUUID())}}});
