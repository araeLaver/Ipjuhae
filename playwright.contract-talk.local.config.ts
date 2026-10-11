import {defineConfig} from '@playwright/test'
process.env.CONTRACT_TALK_LOCAL_E2E = '1'
export default defineConfig({testDir:'./e2e',testMatch:'contract-talk.spec.ts',workers:1,timeout:60000,reporter:[['list'],['html',{outputFolder:'../evidence/contract-talk-browser-report',open:'never'}]],outputDir:'../evidence/contract-talk-browser-results',use:{baseURL:'http://127.0.0.1:3104',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}}})
