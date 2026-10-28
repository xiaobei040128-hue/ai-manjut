import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:'journey-switching.spec.ts',outputDir:'work/journey-switching-artifacts',workers:1,reporter:[['list'],['json',{outputFile:'work/journey-switching-results.json'}]]});
