#!/usr/bin/env node
/* eslint-disable no-console */

import { pathToFileURL } from 'node:url'

function requireEnv(name, fallback) {
  return process.env[name] || fallback
}

function normalizeUrl(raw) {
  const stripped = (raw || '').trim().replace(/\/+$/, '')
  return stripped || 'http://localhost:3000'
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options?.headers || {}),
    },
  })
  const text = await response.text()
  try {
    return { response, json: JSON.parse(text) }
  } catch {
    return { response, json: { raw: text } }
  }
}

async function runCheck({ name, url, method = 'GET', status, body, headers, assert }) {
  try {
    const { response, json } = await fetchJson(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers,
    })
    const gotStatus = response.status
    const ok = (Array.isArray(status) ? status.includes(gotStatus) : gotStatus === status) && (!assert || assert(json))

    if (!ok) {
      return {
        name,
        ok: false,
        detail: `요청: ${method} ${url}, 응답: ${gotStatus}, 본문: ${JSON.stringify(json).slice(0, 240)}`,
      }
    }

    return { name, ok: true, detail: `status=${gotStatus}`, payload: json }
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : '네트워크 오류',
    }
  }
}

// /api/launch/smoke의 조달 미완 항목. 값이 ok:false여도 회귀가 아니라 known gap이므로
// 종료 코드를 1로 만들지 않습니다. 추적: DOW-912
const DEFAULT_EXPECTED_FAILURES = ['sms', 'verification']

export function parseExpectedFailures() {
  const raw = process.env.LAUNCH_SMOKE_EXPECTED_FAILURES
  if (raw === undefined) {
    return { names: DEFAULT_EXPECTED_FAILURES, source: '기본값' }
  }

  const names = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return { names, source: 'LAUNCH_SMOKE_EXPECTED_FAILURES' }
}

// 개별 HTTP 검사와 별개로, /api/launch/smoke 본문의 check 단위 결과를 판정합니다.
// 반환값 true = 회귀 있음(exit 1).
export function reportSmokePayload(launchSmoke) {
  const payloadChecks = launchSmoke?.payload?.checks
  if (!payloadChecks || typeof payloadChecks !== 'object') {
    // 본문을 읽지 못한 경우(토큰 거부, 비JSON 응답 등)는 degraded를 회귀로 간주합니다.
    const degraded = launchSmoke?.detail?.includes('status=503')
    if (degraded) {
      console.log('❌ launch smoke 본문의 checks를 읽지 못했고 status=503입니다. 회귀로 판정합니다.')
    }
    return !!degraded
  }

  const { names: expected, source } = parseExpectedFailures()
  const entries = Object.entries(payloadChecks)
  const failedNames = entries.filter(([, value]) => value?.ok === false).map(([name]) => name)
  const unexpected = failedNames.filter((name) => !expected.includes(name))
  const knownGap = failedNames.filter((name) => expected.includes(name))
  const recovered = expected.filter((name) =>
    entries.some(([checkName, value]) => checkName === name && value?.ok === true)
  )
  const missing = expected.filter((name) => !entries.some(([checkName]) => checkName === name))

  console.log(`허용된 예상 실패(${source}): ${expected.length ? expected.join(', ') : '없음'}`)
  for (const name of knownGap) {
    const message = payloadChecks[name]?.message
    console.log(`⚠️  known gap | ${name}${message ? ` | ${message}` : ''} — DOW-912에서 추적 중, 실패로 세지 않습니다`)
  }
  for (const name of recovered) {
    console.log(`ℹ️  ${name}이(가) 이제 통과합니다. 허용 목록에서 빼 주세요.`)
  }
  for (const name of missing) {
    console.log(`ℹ️  허용 목록의 ${name}이(가) 응답 checks에 없습니다. 이름이 바뀌었는지 확인하세요.`)
  }
  for (const name of unexpected) {
    const message = payloadChecks[name]?.message
    console.log(`❌ 회귀 | ${name}${message ? ` | ${message}` : ''}`)
  }

  return unexpected.length > 0
}

async function main() {
  const baseUrl = normalizeUrl(
    requireEnv('LAUNCH_SMOKE_BASE_URL', requireEnv('APP_URL', requireEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')))
  )
  const token = process.env.LAUNCH_SMOKE_TOKEN

  const commonHeaders = token ? { 'x-launch-smoke-token': token } : undefined
  const mutationHeaders = { origin: new URL(baseUrl).origin }
  const checks = []

  checks.push(await runCheck({
    name: 'launch-smoke-route',
    url: `${baseUrl}/api/launch/smoke`,
    status: [200, 503],
    headers: commonHeaders,
    assert: (payload) => ['ok', 'degraded'].includes(payload.status),
  }))

  checks.push(await runCheck({
    name: 'health',
    url: `${baseUrl}/api/health`,
    status: 200,
    assert: (payload) => payload.status === 'ok' && payload.checks?.database === 'ok',
  }))

  checks.push(await runCheck({
    name: 'listings-public',
    url: `${baseUrl}/api/listings`,
    status: 200,
    assert: (payload) => Array.isArray(payload?.listings),
  }))

  checks.push(await runCheck({
    name: 'phone-validation',
    url: `${baseUrl}/api/auth/phone/send`,
    method: 'POST',
    status: 400,
    body: { phoneNumber: 'invalid' },
    headers: mutationHeaders,
    assert: (payload) => !!payload?.error,
  }))

  checks.push(await runCheck({
    name: 'admin-route-protection',
    url: `${baseUrl}/api/admin/stats`,
    status: [401, 403],
  }))

  const failed = checks.filter((item) => !item.ok)

  console.log('===============================')
  console.log(`Launch smoke checks for ${baseUrl}`)
  console.log(`총 ${checks.length}개 체크, 실패 ${failed.length}개`)
  for (const item of checks) {
    console.log(`${item.ok ? '✅' : '❌'} ${item.name} | ${item.detail}`)
  }
  console.log('===============================')

  if (failed.length > 0) {
    process.exit(1)
  }

  // /api/launch/smoke는 부분 실패를 status=503으로 반환합니다. 503 자체가 아니라
  // 어떤 check가 깨졌는지로 판정해야 known gap과 신규 회귀가 구분됩니다.
  const launchSmoke = checks.find((item) => item.name === 'launch-smoke-route')
  const hasRegression = reportSmokePayload(launchSmoke)
  console.log('===============================')

  process.exit(hasRegression ? 1 : 0)
}

// 테스트에서 판정 함수만 import할 수 있도록, CLI로 직접 실행했을 때만 main을 돌립니다.
const invokedPath = process.argv[1]
const isDirectRun = !!invokedPath && pathToFileURL(invokedPath).href === import.meta.url

if (isDirectRun) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
