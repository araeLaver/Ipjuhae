/**
 * DB 마이그레이션 실행 스크립트
 *
 * 사용법: npx tsx db/migrate.ts
 *
 * 마이그레이션 순서:
 * 1. schema.sql - 기본 스키마 생성
 * 2. migration-002-social-auth.sql - 소셜 로그인, 휴대폰 인증, 서류 업로드
 */

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL 환경변수가 설정되지 않았습니다.')
  console.error('예시: DATABASE_URL=postgresql://user:password@localhost:5432/rentme')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

const migrations = [
  'schema.sql',
  'migration-002-social-auth.sql',
]

async function runMigrations() {
  const client = await pool.connect()

  try {
    console.log('🚀 마이그레이션 시작...\n')

    // 마이그레이션 추적 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    for (const migration of migrations) {
      // 이미 실행된 마이그레이션 확인
      const { rows } = await client.query(
        'SELECT name FROM _migrations WHERE name = $1',
        [migration]
      )

      if (rows.length > 0) {
        console.log(`⏭️  ${migration} - 이미 실행됨, 스킵`)
        continue
      }

      // 마이그레이션 파일 읽기
      const filePath = path.join(__dirname, migration)

      if (!fs.existsSync(filePath)) {
        console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`)
        continue
      }

      const sql = fs.readFileSync(filePath, 'utf-8')

      console.log(`📄 ${migration} 실행 중...`)

      await client.query('BEGIN')

      try {
        await client.query(sql)

        // 마이그레이션 기록
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [migration]
        )

        await client.query('COMMIT')
        console.log(`✅ ${migration} 완료\n`)
      } catch (error) {
        await client.query('ROLLBACK')
        console.error(`❌ ${migration} 실패:`, error)
        throw error
      }
    }

    console.log('🎉 모든 마이그레이션 완료!')

  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().catch((error) => {
  console.error('마이그레이션 실패:', error)
  process.exit(1)
})
