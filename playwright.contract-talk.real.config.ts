import { defineConfig } from '@playwright/test'
export default defineConfig({testDir:'./e2e',testMatch:'contract-talk-real.spec.ts',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:3103',launchOptions:{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}},reporter:[['list']],outputDir:'../evidence/contract-talk-real-browser-results'})
