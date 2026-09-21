#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * 토큰 없이 실행하는 공개 표면 smoke.
 *
 * `launch-smoke.mjs`는 `/api/launch/smoke`가 통과하려면 `LAUNCH_SMOKE_TOKEN`이
 * 필요하다. 운영에서 그 토큰은 Fly secret이고 QA 셸에는 주입되지 않으므로,
 * [DOW-362]/[DOW-366]이 열린 동안 런치 smoke 전체가 멈춰 있었다.
 *
 * 이 스크립트는 **토큰 없이 확인할 수 있는 것만** 본다. 두 종류다.
 *
 * 1. 공개 표면이 실제로 응답하는가 — health, 공개 카탈로그, 입력 validation.
 * 2. 보호가 실제로 걸려 있는가 — 인증·CSRF·cron·launch-smoke 토큰 게이트가
 *    없는 요청을 제대로 막는가. 토큰이 없다는 사실 자체가 체크 대상이 된다.
 *
 * 읽기 전용이다. 쓰기 메서드는 의도적으로 유효하지 않은 입력이나 인증 없는
 * 요청만 보내, 차단 응답을 확인하는 데만 쓴다. 발송·생성이 일어나는 경로는 없다.
 *
 * 사용:
 *   node scripts/public-surface-smoke.mjs https://www.ipjuhae.com
 *   LAUNCH_SMOKE_BASE_URL=https://www.ipjuhae.com node scripts/public-surface-smoke.mjs
 */

function normalizeUrl(raw) {
  const stripped = (raw || '').trim().replace(/\/+$/, '')
  return stripped || 'http://localhost:3000'
}

async function runCheck(baseUrl, { name, path, method = 'GET', status, body, headers, assert, note }) {
  const url = `${baseUrl}${path}`
  try {
    const response = await fetch(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(headers || {}),
      },
    })
    const text = await response.text()
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text.slice(0, 160) }
    }

    const statusOk = Array.isArray(status) ? status.includes(response.status) : response.status === status
    const ok = statusOk && (!assert || assert(payload))
    return {
      name,
      ok,
      note,
      detail: ok
        ? `status=${response.status}`
        : `${method} ${path} → ${response.status}, 본문: ${JSON.stringify(payload).slice(0, 200)}`,
    }
  } catch (error) {
    return { name, ok: false, note, detail: error instanceof Error ? error.message : '네트워크 오류' }
  }
}

async function main() {
  const baseUrl = normalizeUrl(
    process.argv[2] ||
      process.env.LAUNCH_SMOKE_BASE_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL
  )
  const origin = new URL(baseUrl).origin
  const hasError = (payload) => typeof payload?.error === 'string' && payload.error.length > 0

  const specs = [
    // 1. 공개 표면이 응답하는가
    {
      name: 'health',
      path: '/api/health',
      status: 200,
      assert: (p) => p.status === 'ok' && p.checks?.database === 'ok',
    },
    { name: 'listings-public', path: '/api/listings', status: 200, assert: (p) => Array.isArray(p?.listings) },
    { name: 'properties-public', path: '/api/properties', status: 200, assert: (p) => Array.isArray(p?.properties) },
    { name: 'community-posts-public', path: '/api/community/posts', status: 200, assert: (p) => Array.isArray(p?.posts) },

    // 2. 입력 validation — 유효하지 않은 값만 보낸다
    {
      name: 'login-validation',
      path: '/api/auth/login',
      method: 'POST',
      status: [400, 401, 422],
      body: { email: 'not-an-email', password: '' },
      headers: { origin },
      assert: hasError,
    },
    {
      name: 'signup-validation',
      path: '/api/auth/signup',
      method: 'POST',
      status: [400, 422],
      body: { email: 'not-an-email', password: 'x' },
      headers: { origin },
      assert: hasError,
    },
    {
      name: 'phone-validation',
      path: '/api/auth/phone/send',
      method: 'POST',
      status: 400,
      body: { phoneNumber: 'invalid' },
      headers: { origin },
      assert: hasError,
    },

    // 3. 보호가 걸려 있는가 — 토큰/세션 없는 요청
    {
      name: 'launch-smoke-token-gate',
      path: '/api/launch/smoke',
      status: [401, 403],
      assert: hasError,
      note: '운영에서 토큰 없이 열려 있으면 안 된다',
    },
    { name: 'admin-route-protection', path: '/api/admin/stats', status: [401, 403], assert: hasError },
    { name: 'session-me-unauthenticated', path: '/api/auth/me', status: [200, 401], assert: (p) => !p?.user },
    {
      name: 'account-delete-protection',
      path: '/api/account/delete',
      method: 'DELETE',
      status: [401, 403, 405],
      headers: { origin },
      assert: hasError,
    },
    {
      name: 'cron-secret-gate',
      path: '/api/cron/trust-outbox',
      status: [401, 403],
      assert: hasError,
      note: 'CRON_SECRET 없이는 막혀야 한다',
    },
    {
      name: 'csrf-gate',
      path: '/api/rental-risk/brief',
      method: 'POST',
      status: [403],
      body: { address: 'x', complexName: 'x', areaM2: 1, depositManwon: 0, monthlyRentManwon: 0 },
      assert: (p) => p?.code === 'CSRF_INVALID',
      note: 'origin 없는 쓰기 요청은 CSRF에서 막혀야 한다',
    },

    // 4. trust 표면 — happy path는 계정이 필요하므로 보호만 본다
    { name: 'trust-access-logs-protection', path: '/api/access-logs', status: [401, 403], assert: hasError },
    { name: 'trust-consent-events-protection', path: '/api/consent/events', status: [401, 403], assert: hasError },
    { name: 'trust-references-protection', path: '/api/references', status: [401, 403], assert: hasError },
    { name: 'trust-reference-verify-protection', path: '/api/references/verify', status: [401, 403, 405], assert: hasError },
  ]

  const checks = []
  for (const spec of specs) {
    checks.push(await runCheck(baseUrl, spec))
  }
  const failed = checks.filter((item) => !item.ok)

  console.log('===============================')
  console.log(`공개 표면 smoke — ${baseUrl}`)
  console.log(`총 ${checks.length}개 체크, 실패 ${failed.length}개`)
  for (const item of checks) {
    console.log(`${item.ok ? '✅' : '❌'} ${item.name} | ${item.detail}${item.note ? ` (${item.note})` : ''}`)
  }
  console.log('===============================')
  console.log('토큰이 필요한 항목은 여기서 다루지 않는다: npm run launch:smoke (LAUNCH_SMOKE_TOKEN 필요)')

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
