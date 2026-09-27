// 로컬 검증용 DB(ipjuhae_e2e)를 현재 revision 스키마까지 올린다.
//
// 왜 별도 스크립트인가: `db/migrate.ts` 가 정본이지만 에이전트 셸에서 tsx 실행이
// 막히는 환경이 있다. 그때도 로컬 실DB 실측을 포기하지 않으려면 같은 순서·같은
// `_migrations` 기록 방식으로 적용할 경로가 하나 필요하다. 프로덕션에는 절대 쓰지 말 것
// (db/migrate.ts 의 안전장치 assessMigrationBaseline 을 거치지 않는다).
//
// 사용: node scripts/qa/apply_local_migrations.mjs [db이름]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const dbName = process.argv[2] || 'ipjuhae_e2e'

if (!/^ipjuhae_(e2e|local|test)[a-z0-9_]*$/.test(dbName)) {
  console.error(`거부: 로컬 검증용 DB 이름만 허용한다 (받은 값: ${dbName})`)
  process.exit(1)
}

// db/migrate.ts 의 migrations 배열에서 순서를 그대로 읽어 온다 — 손으로 복사하면 어긋난다.
const migrateSrc = fs.readFileSync(path.join(repo, 'db', 'migrate.ts'), 'utf8')
const listBlock = migrateSrc.slice(
  migrateSrc.indexOf('const migrations = ['),
  migrateSrc.indexOf('] as const')
)
const ORDER = [...listBlock.matchAll(/'([^']+\.sql)'/g)].map((m) => m[1])
if (ORDER.length === 0) {
  console.error('db/migrate.ts 에서 마이그레이션 목록을 읽지 못했다')
  process.exit(1)
}

const client = new Client({
  connectionString: `postgresql://${process.env.USER}@localhost:5432/${dbName}`,
  ssl: false,
})
await client.connect()

const applied = new Set(
  (await client.query('SELECT name FROM ipjuhae._migrations')).rows.map((r) => r.name)
)

let failed = 0
for (const name of ORDER) {
  if (applied.has(name)) continue
  const sql = fs.readFileSync(path.join(repo, 'db', name), 'utf8')
  try {
    await client.query('BEGIN')
    await client.query('SET search_path TO ipjuhae, public')
    await client.query(sql)
    await client.query('INSERT INTO ipjuhae._migrations (name) VALUES ($1)', [name])
    await client.query('COMMIT')
    console.log('OK  ', name)
  } catch (e) {
    await client.query('ROLLBACK')
    failed += 1
    console.log('FAIL', name, '-', String(e.message).slice(0, 200))
  }
}

const cols = await client.query(
  `SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'ipjuhae' AND table_name IN ('community_posts', 'community_comments')
    ORDER BY table_name, ordinal_position`
)
const byTable = {}
for (const r of cols.rows) (byTable[r.table_name] ||= []).push(r.column_name)
console.log(JSON.stringify(byTable, null, 1))
await client.end()
process.exit(failed > 0 ? 1 : 0)
