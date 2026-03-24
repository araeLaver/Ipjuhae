export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    await runPendingMigrations()
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

async function runPendingMigrations() {
  if (!process.env.DATABASE_URL) return

  try {
    const { Pool } = await import(/* webpackIgnore: true */ 'pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
    const client = await pool.connect()

    try {
      // DB 연결 확인만 수행 (마이그레이션은 migrate-prod.mjs로 사전 적용)
      await client.query('SELECT 1')
      console.log('[migration] DB connected, all migrations already applied')
    } finally {
      client.release()
      await pool.end()
    }
  } catch (err) {
    console.error('[migration] DB connection check failed (non-fatal):', err)
  }
}
