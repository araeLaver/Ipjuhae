const { Pool } = require('pg')
const { migratePolicyNews } = require('./migrate-policy-news.cjs')
const schema = `qa_policy_${Date.now()}`
const databaseUrl = `postgresql://${process.env.USER}@localhost:5432/ipjuhae_db`
const pool = new Pool({ connectionString: databaseUrl })

async function verify() {
  await pool.query(`CREATE SCHEMA ${schema}`)
  process.env.DATABASE_URL = databaseUrl
  process.env.DB_SCHEMA = schema
  process.env.PUBLIC_DATA_API_KEY = 'fixture-key'
  try {
    // Check idempotence and the same release migration entrypoint.
    await migratePolicyNews()
    await migratePolicyNews()
    const fixture = [{ id: 'durable', title: '전세 지원', url: 'https://www.korea.kr',
      summary: '', approvedAt: '2026-10-05', ministry: '' }]
    await pool.query(`UPDATE ${schema}.policy_news_state SET last_success_at = now(), items = $1::jsonb WHERE id = 1`,
      [JSON.stringify(fixture)])
    const { readPolicyNews, getPolicyNewsStatus, refreshPolicyNews } = require('../build/policy-news.cjs')
    if ((await getPolicyNewsStatus()).status !== 'ok') throw new Error('health')
    if ((await readPolicyNews())[0].id !== 'durable') throw new Error('persistence')
    global.fetch = async () => new Response('<response><header><resultCode>30</resultCode></header></response>')
    if ((await refreshPolicyNews()).complete !== false) throw new Error('failure detection')
    if ((await readPolicyNews())[0].id !== 'durable') throw new Error('lost snapshot')
    await pool.query(`UPDATE ${schema}.policy_news_state SET last_success_at = now() - interval '25 hours' WHERE id = 1`)
    if ((await getPolicyNewsStatus()).status !== 'stale') throw new Error('stale detection')
    console.log('Real PostgreSQL: migration, persistent read, failed refresh retention, stale detection PASS')
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await pool.end()
  }
}

verify().then(() => process.exit(0)).catch(() => {
  console.error('Local policy DB verification failed')
  process.exit(1)
})
