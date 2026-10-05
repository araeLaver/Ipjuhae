const { Pool } = require('pg')
const fs = require('node:fs')
const path = require('node:path')

async function migratePolicyNews() {
  const schema = process.env.DB_SCHEMA || 'ipjuhae'
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) throw new Error('INVALID_DB_SCHEMA')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING')
  const { resolveDbSsl } = await import('../lib/db-ssl.mjs')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: resolveDbSsl(process.env.DATABASE_URL, { rejectUnauthorized: process.env.NODE_ENV === 'production' }),
    connectionTimeoutMillis: 5000, statement_timeout: 10000 })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [47052027])
    const exists = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [schema])
    if (!exists.rowCount) throw new Error('DB_SCHEMA_MISSING')
    await client.query(`SET LOCAL search_path TO "${schema}"`)
    await client.query(fs.readFileSync(path.join(__dirname, '../db/migration-047-policy-news.sql'), 'utf8'))
    const tracking = await client.query("SELECT to_regclass('_migrations') AS tracking")
    if (tracking.rows[0].tracking) {
      await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', ['migration-047-policy-news.sql'])
    }
    await client.query('COMMIT')
    console.log('[policy-news] migration ready')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

module.exports = { migratePolicyNews }
if (require.main === module) {
  if (!process.env.PUBLIC_DATA_API_KEY) {
    console.error('[policy-news] API key missing; release blocked')
    process.exit(1)
  }
  migratePolicyNews().then(async () => {
    const { refreshPolicyNews, getPolicyNewsStatus } = require('../build/policy-news.cjs')
    const result = await refreshPolicyNews()
    const health = await getPolicyNewsStatus()
    if (health.status !== 'ok' || (result && 'complete' in result && !result.complete)) {
      throw new Error('INITIAL_REFRESH_FAILED')
    }
    console.log('[policy-news] release freshness verified')
    process.exit(0)
  }).catch(() => {
    console.error('[policy-news] release verification failed')
    process.exit(1)
  })
}
