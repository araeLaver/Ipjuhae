#!/usr/bin/env node
/* eslint-disable no-console */

// 로컬 검증용 DB를 migration 전량 적용 상태까지 올린다.
//
// migration-035는 운영자 admin 계정(users 행)이 이미 있다고 가정하고, 없으면 일부러
// 실패한다. 신규 로컬 DB에는 그 행이 없어서 migration이 035에서 멈추는데, 이 스크립트가
// 자리표시자 행을 넣고 이어서 적용한다. 근거: DOW-1156.
//
// 사용:
//   DATABASE_URL=postgresql://<user>@localhost:5432/ipjuhae_db \
//   DB_SCHEMA=ipjuhae node scripts/bootstrap-local-db.mjs

import { spawnSync } from 'node:child_process'
import pg from 'pg'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL
const schema = process.env.DB_SCHEMA || 'ipjuhae'
const adminEmail = process.env.LOCAL_ADMIN_EMAIL || 'ipjuhae.official@gmail.com'

if (!connectionString) {
  console.error('DATABASE_URL이 필요합니다.')
  process.exit(1)
}

// 안전장치: 운영 DB에는 절대 돌지 않는다. host가 로컬이 아니면 즉시 중단한다.
// 참고로 lib/db.ts와 db/migrate.ts는 연결 문자열에 'localhost'가 들어있을 때만 SSL을
// 끄므로, 로컬에서는 host를 127.0.0.1이 아니라 localhost로 써야 한다(DOW-1152).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
let host
try {
  host = new URL(connectionString).hostname
} catch {
  console.error('DATABASE_URL을 URL로 해석하지 못했습니다.')
  process.exit(1)
}
if (!LOCAL_HOSTS.has(host)) {
  console.error(`로컬 DB에서만 실행할 수 있습니다. 현재 host=${host}`)
  process.exit(1)
}
if (host !== 'localhost') {
  console.error(`host가 '${host}'라 SSL 분기에 걸립니다. DATABASE_URL의 host를 localhost로 바꿔 주세요(DOW-1152).`)
  process.exit(1)
}

function runMigrate() {
  console.log('--- npx tsx db/migrate.ts')
  return spawnSync('npx', ['tsx', 'db/migrate.ts'], { stdio: 'inherit' }).status
}

async function ensureAdminPlaceholder() {
  const pool = new Pool({ connectionString, ssl: false })
  try {
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${schema}, public`)
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail])
      if (existing.rowCount > 0) return false

      await client.query('INSERT INTO users (email) VALUES ($1)', [adminEmail])
      console.log(`--- ${adminEmail} 자리표시자 행을 넣었습니다(로컬 전용).`)
      return true
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

async function main() {
  if (runMigrate() === 0) {
    console.log('--- migration 전량 적용 완료.')
    return
  }

  console.log('--- migration이 실패했습니다. admin 자리표시자 누락인지 확인합니다.')
  const inserted = await ensureAdminPlaceholder()
  if (!inserted) {
    console.error(`--- ${adminEmail} 행은 이미 있습니다. admin 게이트 문제가 아니므로 위 로그를 확인하세요.`)
    process.exit(1)
  }

  if (runMigrate() !== 0) {
    console.error('--- 자리표시자를 넣은 뒤에도 migration이 실패했습니다.')
    process.exit(1)
  }
  console.log('--- migration 전량 적용 완료.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
