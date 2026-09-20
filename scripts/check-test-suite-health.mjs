import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 기준치 갱신: npm run test:ci의 전체 실행이 정상인지 확인한 뒤 실측 테스트 수를
// BASELINE_TESTS에 반영하고, 추가/삭제 이유를 커밋 메시지에 남긴다.
// 실패한 스위트 때문에 줄어든 수에 맞춰 기준치를 낮추지 않는다.
const BASELINE_TESTS = 449
const ALLOWED_DROP = 0.02
const floor = Math.ceil(BASELINE_TESTS * (1 - ALLOWED_DROP))
const directory = mkdtempSync(join(tmpdir(), 'rentme-test-health-'))
const reportPath = join(directory, 'report.json')

function error(message) {
  console.error(message)
  if (process.env.GITHUB_ACTIONS === 'true') {
    const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
    console.error(`::error title=테스트 건강도 점검::${escaped}`)
  }
}

try {
  const vitest = spawnSync(process.execPath, [
    './node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2),
    '--reporter=default', '--reporter=json', `--outputFile.json=${reportPath}`,
  ], { stdio: 'inherit' })
  if (vitest.error) throw vitest.error
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  if (!Number.isInteger(report.numTotalTests) || !Array.isArray(report.testResults)) {
    throw new Error('테스트 수 또는 스위트 목록이 없는 리포트입니다.')
  }
  const dead = report.testResults.filter(
    suite => suite.status === 'failed' && suite.assertionResults?.length === 0,
  )
  const problems = []
  if (dead.length) {
    problems.push(`죽은 스위트 ${dead.length}개: 로드 단계 실패로 테스트를 실행하지 못했습니다.`)
    for (const suite of dead) {
      problems.push(`${suite.name}: ${(suite.message ?? '').trim().split('\n')[0]}`)
    }
  }
  if (report.numTotalTests < floor) {
    problems.push(`테스트 수 ${report.numTotalTests} < 하한 ${floor} (기준치 ${BASELINE_TESTS}, 허용 감소율 ${ALLOWED_DROP * 100}%)`)
  }
  const measured = `실측 테스트 ${report.numTotalTests}개 / 파일 ${report.testResults.length}개 / 죽은 스위트 ${dead.length}개 (하한 ${floor})`
  console.log(`\n${measured}`)
  for (const problem of problems) error(problem)
  if (vitest.status !== 0 || report.success !== true) {
    error(`Vitest 실행 실패 (종료 코드 ${vitest.status}, signal ${vitest.signal ?? '없음'}). 위 테스트 로그를 확인하세요.`)
  }
  process.exitCode = problems.length || vitest.status !== 0 || report.success !== true ? 1 : 0
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### 테스트 건강도 ${process.exitCode ? '실패' : '통과'}\n\n${measured}\n\n${problems.map(p => `- ${p}`).join('\n')}\n`)
  }
} catch (err) {
  error(`테스트 건강도 점검 실패: 실행 또는 리포트 읽기 오류: ${err.message}`)
  process.exitCode = 1
} finally {
  rmSync(directory, { recursive: true, force: true })
}
