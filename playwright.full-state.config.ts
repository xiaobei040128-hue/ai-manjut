import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'full-state-matrix.spec.ts',timeout:60000,workers:2,reporter:[['list'],['json',{outputFile:'work/full-state-results.json'}]],use:{...base.use,viewport:{width:390,height:844}}});
