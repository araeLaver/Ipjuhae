/**
 * DB 마이그레이션 실행 스크립트
 *
 * 사용법: npx tsx db/migrate.ts
 *
 * 마이그레이션 순서:
 *  1. schema.sql                              - 기본 스키마 생성
 *  2. migration-002-social-auth.sql           - 소셜 로그인, 휴대폰 인증, 서류 업로드
 *  3. migration-003-favorites.sql             - 세입자 즐겨찾기
 *  4. migration-004-messages.sql              - 대화방, 메시지
 *  5. migration-005-properties.sql            - 매물, 매물 이미지
 *  6. migration-006-waitlist.sql              - 대기자 명단
 *  7. migration-007-tenant-search.sql         - 세입자 검색 인덱스
 *  8. migration-008-admin.sql                 - 관리자 타입 + 서류 심사
 *  9. migration-009-notifications.sql         - 알림 시스템
 * 10. migration-010-early-access.sql          - 얼리액세스
 * 11. migration-010-mvp-schema-gaps.sql       - listings/구독/인증 컬럼 보강
 * 12. migration-011-tenant-profile.sql        - 임차인 프로필
 * 13. migration-011-reviews.sql               - 리뷰/평점
 * 14. migration-012-references-trust-score.sql- 레퍼런스 + 신뢰점수
 * 15. migration-012-stripe.sql                - Stripe 결제 연동
 * 16. migration-013-analytics-events.sql      - 애널리틱스 이벤트
 * 17. migration-013-notification-prefs.sql    - 알림 수신 설정
 * 18. migration-014-beta-invites.sql          - 베타 초대 시스템
 * 19. migration-014-premium.sql               - 프리미엄 기능
 * 20. migration-015-listings.sql              - 매물 관리 강화
 * 21. migration-015-cron-fix.sql              - Cron 작업 수정
 * 22. migration-016-listings-pet.sql          - 매물 반려동물 허용 여부
 * 23. migration-016-analytics.sql             - 분석 기능 보강
 * 24. migration-020-properties-pet-allowed.sql - properties.pet_allowed + listings 데이터 통합
 * 25. migration-021-community.sql              - 역할별 커뮤니티 게시판
 */

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const DATABASE_URL = process.env.DATABASE_URL
const DB_SCHEMA = getSafeSchemaName(process.env.DB_SCHEMA || 'ipjuhae')

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL 환경변수가 설정되지 않았습니다.')
  console.error('예시: DATABASE_URL=postgresql://user:password@localhost:5432/rentme')
  process.exit(1)
}

function getSafeSchemaName(schema: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('DB_SCHEMA 환경변수가 유효한 PostgreSQL 스키마명이 아닙니다')
  }
  return schema
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname
    return ['localhost', '127.0.0.1', '::1', 'db'].includes(hostname)
  } catch {
    return databaseUrl.includes('localhost')
  }
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocalDatabaseUrl(DATABASE_URL) ? false : { rejectUnauthorized: false },
})

const migrations = [
  'schema.sql',
  'migration-001-magic-link.sql',
  'migration-002-social-auth.sql',
  'migration-003-favorites.sql',
  'migration-004-messages.sql',
  'migration-005-properties.sql',
  'migration-006-waitlist.sql',
  'migration-007-tenant-search.sql',
  'migration-008-admin.sql',
  'migration-009-notifications.sql',
  'migration-010-early-access.sql',
  'migration-010-mvp-schema-gaps.sql',
  'migration-011-tenant-profile.sql',
  'migration-011-reviews.sql',
  'migration-012-references-trust-score.sql',
  'migration-012-stripe.sql',
  'migration-013-analytics-events.sql',
  'migration-013-notification-prefs.sql',
  'migration-014-beta-invites.sql',
  'migration-014-premium.sql',
  'migration-015-listings.sql',
  'migration-015-cron-fix.sql',
  'migration-016-listings-pet.sql',
  'migration-016-analytics.sql',
  'migration-020-properties-pet-allowed.sql',
  'migration-021-community.sql',
]

async function runMigrations() {
  const client = await pool.connect()

  try {
    console.log(`🚀 마이그레이션 시작... (스키마: ${DB_SCHEMA})\n`)

    // ipjuhae 스키마 생성 및 search_path 설정
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA}`)
    await client.query(`SET search_path TO ${DB_SCHEMA}, public`)

    console.log(`✅ 스키마 '${DB_SCHEMA}' 준비 완료\n`)

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
