import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { parseExpectedFailures, reportSmokePayload } from '@/scripts/launch-smoke.mjs'

function smokeCheck(overrides: Record<string, { ok: boolean; message?: string }> = {}) {
  const checks = {
    database: { ok: true },
    jwt_secret: { ok: true },
    sms: { ok: true },
    email: { ok: true },
    storage: { ok: true },
    verification: { ok: true },
    runtime_env: { ok: true },
    ...overrides,
  }
  const allOk = Object.values(checks).every((check) => check.ok)
  return {
    name: 'launch-smoke-route',
    ok: true,
    detail: `status=${allOk ? 200 : 503}`,
    payload: { status: allOk ? 'ok' : 'degraded', checks },
  }
}

describe('launch-smoke 종료 판정', () => {
  const originalExpected = process.env.LAUNCH_SMOKE_EXPECTED_FAILURES

  beforeEach(() => {
    delete process.env.LAUNCH_SMOKE_EXPECTED_FAILURES
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalExpected === undefined) {
      delete process.env.LAUNCH_SMOKE_EXPECTED_FAILURES
    } else {
      process.env.LAUNCH_SMOKE_EXPECTED_FAILURES = originalExpected
    }
  })

  it('기본 허용 목록은 sms/verification이다', () => {
    expect(parseExpectedFailures()).toEqual({ names: ['sms', 'verification'], source: '기본값' })
  })

  it('env가 있으면 그 목록을 쓰고, 빈 문자열은 허용 없음이다', () => {
    process.env.LAUNCH_SMOKE_EXPECTED_FAILURES = ' sms , email '
    expect(parseExpectedFailures()).toEqual({
      names: ['sms', 'email'],
      source: 'LAUNCH_SMOKE_EXPECTED_FAILURES',
    })

    process.env.LAUNCH_SMOKE_EXPECTED_FAILURES = ''
    expect(parseExpectedFailures().names).toEqual([])
  })

  it('모두 통과하면 회귀가 아니다', () => {
    expect(reportSmokePayload(smokeCheck())).toBe(false)
  })

  it('known gap(sms/verification)만 깨지면 503이어도 회귀가 아니다', () => {
    const result = smokeCheck({
      sms: { ok: false, message: 'SMS_PROVIDER 미설정' },
      verification: { ok: false, message: 'VERIFICATION_PROVIDER 미설정' },
    })
    expect(result.detail).toContain('status=503')
    expect(reportSmokePayload(result)).toBe(false)
  })

  it('허용 목록 밖의 check가 깨지면 회귀다', () => {
    const result = smokeCheck({
      sms: { ok: false },
      verification: { ok: false },
      database: { ok: false, message: 'DB 연결/쿼리 실패' },
    })
    expect(reportSmokePayload(result)).toBe(true)
  })

  it('허용 목록을 비우면 known gap도 회귀로 잡힌다', () => {
    process.env.LAUNCH_SMOKE_EXPECTED_FAILURES = ''
    expect(reportSmokePayload(smokeCheck({ sms: { ok: false } }))).toBe(true)
  })

  it('본문을 못 읽은 503은 회귀로 본다', () => {
    expect(
      reportSmokePayload({ name: 'launch-smoke-route', ok: true, detail: 'status=503' })
    ).toBe(true)
  })

  it('본문을 못 읽었고 200이면 회귀가 아니다', () => {
    expect(
      reportSmokePayload({ name: 'launch-smoke-route', ok: true, detail: 'status=200' })
    ).toBe(false)
  })
})
