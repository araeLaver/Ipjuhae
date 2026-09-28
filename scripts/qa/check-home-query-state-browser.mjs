// 격리된 HEAD 사본에서 pg 응답을 주입해 실제 Next.js·Chromium 화면을 검증한다.
import { mkdtemp, writeFile, symlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { chromium, expect } from '@playwright/test'
const root = process.cwd()
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim()
const dir = await mkdtemp(path.join(tmpdir(), 'rentme-home-qa-'))
const out = path.join(dir, 'evidence')
await mkdir(out)
execFileSync('git', ['archive', '--output=' + path.join(dir, 'source.tar'), commit])
execFileSync('tar', ['-xf', path.join(dir, 'source.tar'), '-C', dir])
await symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'))
const state = path.join(dir, 'state.txt')
await writeFile(state, 'empty')
const hook = path.join(dir, 'pg-fixture.cjs')
await writeFile(hook, `
const Module = require('module'); const fs = require('fs'); const original = Module._load;
class Pool {
 on() { return this }
 async connect() { return {query: this.query.bind(this), release() {}} }
 async query(sql) {
  if (/SET search_path/.test(sql)) return {rows: []};
  const state = fs.readFileSync(process.env.QA_HOME_STATE, 'utf8');
  if (/FROM community_posts p/.test(sql) && /LIMIT 200/.test(sql)) {
   if (state === 'error') throw Error('QA DB 예외 주입');
   if (state === 'timeout') await new Promise(r => setTimeout(r, 3500));
   if (state === 'data' || state === 'timeout') return {rows: [{id:'00000000-0000-4000-8000-000000000001', title:'QA 보증금 반환 질문',body:'QA 질문 본문', comment_count:2, view_count:3, created_at:'2026-09-28',author_role:'member'}]};
  }
  return {rows: []};
 }
 async end() {}
}
require('pg').Pool = Pool;
Module._load = function(name, ...args) { return (name === 'pg' || /[/]pg[/]lib[/]index[.]js$/.test(name)) ? {Pool} : original.call(this, name, ...args) };
`)
const port = process.env.QA_HOME_PORT || '3197'
const base = `http://127.0.0.1:${port}`
let log = '', browser
const results = []
const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port], {
 cwd: dir, env: {...process.env, NODE_ENV:'development', NODE_OPTIONS:`--require=${hook}`, QA_HOME_STATE:state, DATABASE_URL:'postgresql://qa:qa@127.0.0.1:1/qa', UPSTASH_REDIS_REST_URL:'', UPSTASH_REDIS_REST_TOKEN:''}, stdio:['ignore','pipe','pipe'],
})
server.stdout.on('data', d => log += d)
server.stderr.on('data', d => log += d)
try {
 for (let i=0;i<120;i++) {
  if (server.exitCode !== null) throw Error('QA 서버 시작 실패: '+log)
  try { if ((await fetch(base)).ok) break } catch {}
  if (i===119) throw Error('QA 서버 시작 시간 초과')
  await new Promise(r=>setTimeout(r,500))
 }
 browser = await chromium.launch({headless:true})
 const page = await browser.newPage()
 page.setDefaultTimeout(15000)
 page.setDefaultNavigationTimeout(60000)
 await page.route('**/*', route => route.request().url().startsWith(base+'/') ? route.continue() : route.fulfill({status:200,body:''}))
 for (const width of [1280,390]) {
  await page.setViewportSize({width,height:844})
  for (const mode of ['empty','data','error','timeout']) {
   await writeFile(state,mode)
   const started=Date.now()
   const response=await page.goto(base, {waitUntil:'domcontentloaded',timeout:60000})
   expect(response.status()).toBe(200)
   const failed = mode==='error'||mode==='timeout'
   await expect(page.getByText('질문을 불러오지 못했습니다. 잠시 후 다시 열어주세요.', {exact:true})).toHaveCount(failed?1:0)
   await expect(page.getByText('아직 올라온 질문이 없습니다. 처음 물어보시는 분이 되어주세요.', {exact:true})).toHaveCount(mode==='empty'?1:0)
   await expect(page.getByRole('link',{name:'질문 남기기',exact:true})).toHaveCount(mode==='empty'?1:0)
   if(mode==='data') await expect(page.locator('a[href="/community/00000000-0000-4000-8000-000000000001"]')).toContainText('댓글 2')
   await expect(page.getByRole('link',{name:'보증금 점검하기',exact:true})).toBeVisible()
   await expect(page.getByRole('link',{name:'제도 전체 보기',exact:true})).toBeVisible()
   await page.screenshot({path:path.join(out,`${width}-${mode}.png`),fullPage:true})
   const elapsed=Date.now()-started
   if(failed) {
    await page.getByRole('link',{name:'게시판으로 이동',exact:true}).click()
    await expect(page).toHaveURL(base+'/community')
    await expect(page.locator('main').last()).toBeVisible()
    await page.goto(base)
   }
   await page.getByRole('link',{name:'보증금 점검하기',exact:true}).click()
   await expect(page).toHaveURL(base+'/check')
   await expect(page.locator('main').last()).toBeVisible()
   results.push({화면너비:width,상태:mode,결과:'통과',홈소요ms:elapsed})
   console.log(JSON.stringify(results.at(-1)))
  }
 }
} finally {
 await browser?.close()
 server.kill('SIGTERM')
 await writeFile(path.join(out,'server.log'),log)
 await writeFile(path.join(out,'results.json'),JSON.stringify({commit,results},null,2))
 console.log('검증 증거: '+out)
}
