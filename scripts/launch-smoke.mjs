#!/usr/bin/env node
/* eslint-disable no-console */

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

    return { name, ok: true, detail: `status=${gotStatus}` }
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : '네트워크 오류',
    }
  }
}

async function main() {
  const baseUrl = normalizeUrl(
    requireEnv('LAUNCH_SMOKE_BASE_URL', requireEnv('APP_URL', requireEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')))
  )
  const csrfOrigin = normalizeUrl(requireEnv('LAUNCH_SMOKE_ORIGIN', baseUrl))
  const token = process.env.LAUNCH_SMOKE_TOKEN

  const commonHeaders = token ? { 'x-launch-smoke-token': token } : undefined
  const checks = []

  checks.push(await runCheck({
    name: 'launch-smoke-route',
    url: `${baseUrl}/api/launch/smoke`,
    status: 200,
    headers: commonHeaders,
    assert: (payload) => payload.status === 'ok',
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
    headers: { origin: csrfOrigin, 'x-mobile-client': 'true' },
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

  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
