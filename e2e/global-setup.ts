import { Client } from 'pg'

const DB_SCHEMA = process.env.DB_SCHEMA || 'ipjuhae'

/**
 * Seeds the isolated E2E database into a state the authenticated flows expect.
 * Runs only when PLAYWRIGHT_DATABASE_URL points at a real (test) DB — otherwise
 * it is a no-op, so the default CI run (no DB) is unaffected.
 *
 * Currently: disables beta mode so direct signup is allowed (production seeds
 * beta_enabled=true, which would 403 the signup flow without an invite token).
 */
export default async function globalSetup(): Promise<void> {
  const url = process.env.PLAYWRIGHT_DATABASE_URL
  if (!url) return

  const client = new Client({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
  })

  await client.connect()
  try {
    await client.query(`SET search_path TO ${DB_SCHEMA}, public`)
    const updated = await client.query(
      `UPDATE beta_config SET value = 'false' WHERE key = 'beta_enabled'`,
    )
    if (updated.rowCount === 0) {
      await client.query(
        `INSERT INTO beta_config (key, value) VALUES ('beta_enabled', 'false')`,
      )
    }
  } finally {
    await client.end()
  }
}
