/**
 * 웹과 앱이 같은 계산을 하는지 확인한다.
 *
 * 보증금 위험 계산은 두 곳에 있다. 한쪽만 고치면 웹에서는 "위험"인데
 * 앱에서는 "안전"이라고 나온다. 그런 화면은 없느니만 못하다.
 */
import { readFileSync } from 'node:fs'

const PAIRS = [['lib/deposit-risk.ts', 'mobile/src/lib/depositRisk.ts']]

/** 서로를 가리키는 주석 한 줄만 다르다. 그 줄은 빼고 비교한다. */
const normalize = (s) =>
  s
    .split('\n')
    .filter((line) => !line.includes('쌍이다'))
    .join('\n')
    .trim()

let failed = false

for (const [a, b] of PAIRS) {
  const left = normalize(readFileSync(a, 'utf8'))
  const right = normalize(readFileSync(b, 'utf8'))

  if (left === right) {
    console.log(`ok  ${a} = ${b}`)
    continue
  }

  failed = true
  console.error(`\n어긋남  ${a} != ${b}`)

  const la = left.split('\n')
  const lb = right.split('\n')
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      console.error(`  줄 ${i + 1}`)
      console.error(`    ${a}: ${la[i] ?? '(없음)'}`)
      console.error(`    ${b}: ${lb[i] ?? '(없음)'}`)
      break
    }
  }
  console.error(`\n  고친 쪽을 다른 쪽으로 복사하세요.`)
}

if (failed) process.exit(1)
console.log('\n웹과 앱의 계산이 같습니다.')
