/**
 * DOW-1165 item 3 — import는 있는데 호출이 없는 limiter를 찾는다.
 *
 * lib/rate-limit.ts 에서 import한 심볼 하나하나가 같은 파일 안에서 실제로
 * 호출되는지 본다. 이름만 grep하면 import 줄 자체에 걸려 늘 "있음"이 된다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['app', 'lib', 'components', 'middleware.ts']
const files = []
function walk(p) {
  let st
  try { st = statSync(p) } catch { return }
  if (st.isDirectory()) {
    if (p.includes('node_modules') || p.includes('.next')) return
    for (const e of readdirSync(p)) walk(join(p, e))
  } else if (/\.(ts|tsx|mjs)$/.test(p)) files.push(p)
}
roots.forEach(walk)

const LIMITER_SYMBOLS = new Set(['rateLimit', 'authRateLimit', 'apiRateLimit'])
const rows = []

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // rate-limit 모듈에서 가져온 심볼만 본다.
  const im = src.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*rate-limit['"]/)
  if (!im) continue
  const symbols = im[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)
  // import 줄을 지운 본문에서 호출 여부를 센다.
  const bodyOnly = src.replace(im[0], '')
  for (const s of symbols) {
    const calls = (bodyOnly.match(new RegExp('\\b' + s + '\\s*\\(', 'g')) || []).length
    rows.push({ file: f, symbol: s, calls, limiter: LIMITER_SYMBOLS.has(s) })
  }
}

const dead = rows.filter(r => r.calls === 0)
const deadLimiters = dead.filter(r => r.limiter)

console.log('rate-limit 모듈을 import하는 파일:', new Set(rows.map(r => r.file)).size)
console.log('import한 심볼 총계:', rows.length)
console.log('')
console.log('--- limiter 심볼 호출 현황 ---')
for (const r of rows.filter(r => r.limiter).sort((a, b) => a.file.localeCompare(b.file))) {
  console.log(`${r.calls === 0 ? 'MISSING' : 'ok     '} ${r.symbol.padEnd(15)} ${r.calls}회  ${r.file}`)
}
console.log('')
console.log('--- import만 하고 한 번도 호출 안 한 심볼 (limiter 외 포함) ---')
if (dead.length === 0) console.log('없음')
for (const r of dead) console.log(`${r.symbol}  ${r.file}  (limiter=${r.limiter})`)
console.log('')
console.log('미호출 limiter 개수:', deadLimiters.length)
