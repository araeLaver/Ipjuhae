import fs from 'fs'
import path from 'path'
import { Pool, type PoolClient } from 'pg'
import {
  assessMigrationBaseline,
  pendingMigrations,
  quoteIdentifier,
  validateSchemaIdentifier,
  type MigrationInventory,
} from './migration-safety'

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
  'migration-021-trust-access-and-appeal.sql',
  'migration-022-dispute-status-constraint-fix.sql',
  'migration-023-idempotency-reference-token-hardening.sql',
  'migration-024-patent-trust-engine.sql',
  'migration-025-trust-operations.sql',
  'migration-026-evidence-fact-cascade.sql',
  'migration-027-trust-model-alignment.sql',
  'migration-028-contract-report-productization.sql',
  'migration-029-compliance-gate-audit.sql',
  'migration-030-trust-stage-performance.sql',
  'migration-031-trust-disclosure-matrix.sql',
] as const

const args = process.argv.slice(2)
const planOnly = args.length === 1 && args[0] === '--plan'

if (args.length > 0 && !planOnly) {
  console.error('Usage: npx tsx db/migrate.ts [--plan]')
  process.exit(1)
}

const databaseUrl = process.env.DATABASE_URL ?? ''

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is required.')
  process.exit(1)
}

const dbSchema = validateSchemaIdentifier(process.env.DB_SCHEMA || 'ipjuhae')
const quotedSchema = quoteIdentifier(dbSchema)
const migrationsTable = `${quotedSchema}.${quoteIdentifier('_migrations')}`

function migrationPath(migration: string): string {
  return path.join(__dirname, migration)
}

function assertMigrationFilesExist(): void {
  const missingFiles = migrations.filter(
    (migration) => !fs.existsSync(migrationPath(migration))
  )

  if (missingFiles.length > 0) {
    throw new Error(
      `Migration manifest references missing files: ${missingFiles.join(', ')}`
    )
  }
}

async function inspectDatabaseReadOnly(
  client: PoolClient
): Promise<MigrationInventory> {
  let transactionOpen = false

  try {
    await client.query('BEGIN READ ONLY')
    transactionOpen = true

    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
      [dbSchema]
    )
    const tableNames = tableRows.map((row) => row.table_name)
    const trackingTableExists = tableNames.includes('_migrations')

    let appliedMigrations: string[] = []
    if (trackingTableExists) {
      const { rows } = await client.query<{ name: string }>(
        `SELECT name FROM ${migrationsTable} ORDER BY id`
      )
      appliedMigrations = rows.map((row) => row.name)
    }

    await client.query('COMMIT')
    transactionOpen = false

    return { tableNames, trackingTableExists, appliedMigrations }
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK').catch(() => undefined)
    }
    throw error
  }
}

function printPlan(
  state: 'empty' | 'tracked',
  applied: readonly string[],
  pending: readonly string[]
): void {
  console.log(`[preflight] schema=${dbSchema} baseline=${state}`)
  console.log(
    `[plan] known=${migrations.length} applied=${applied.length} pending=${pending.length}`
  )

  if (pending.length === 0) {
    console.log('[plan] No pending migrations.')
    return
  }

  for (const migration of pending) {
    console.log(`[plan] APPLY ${migration}`)
  }
}

async function applyMigrations(
  client: PoolClient,
  pending: readonly string[]
): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${quotedSchema}`)
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  for (const migration of pending) {
    const sql = fs.readFileSync(migrationPath(migration), 'utf-8')
    await client.query('BEGIN')

    try {
      await client.query(`SET LOCAL search_path TO ${quotedSchema}, public`)

      // Re-check under the write transaction so a concurrent runner cannot
      // cause the same migration to be recorded twice.
      const { rows } = await client.query(
        `SELECT name FROM ${migrationsTable} WHERE name = $1`,
        [migration]
      )

      if (rows.length > 0) {
        await client.query('COMMIT')
        console.log(`[skip] ${migration} was already applied.`)
        continue
      }

      console.log(`[apply] ${migration}`)
      await client.query(sql)
      await client.query(`INSERT INTO ${migrationsTable} (name) VALUES ($1)`, [
        migration,
      ])
      await client.query('COMMIT')
      console.log(`[done] ${migration}`)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      console.error(`[failed] ${migration}`)
      throw error
    }
  }
}

async function run(): Promise<void> {
  assertMigrationFilesExist()

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost')
      ? false
      : { rejectUnauthorized: false },
  })
  let client: PoolClient | undefined
  let advisoryLockAcquired = false

  try {
    client = await pool.connect()

    if (!planOnly) {
      await client.query('SELECT pg_advisory_lock(hashtext($1))', [
        `rentme:migrations:${dbSchema}`,
      ])
      advisoryLockAcquired = true
    }

    const inventory = await inspectDatabaseReadOnly(client)
    const baseline = assessMigrationBaseline(inventory)
    const pending = pendingMigrations(migrations, inventory.appliedMigrations)
    printPlan(
      baseline.state,
      inventory.appliedMigrations,
      pending
    )

    if (planOnly) {
      console.log('[plan] Read-only preflight complete; no database changes made.')
      return
    }

    await applyMigrations(client, pending)
    console.log('[complete] All pending migrations were applied.')
  } finally {
    if (client && advisoryLockAcquired) {
      await client
        .query('SELECT pg_advisory_unlock(hashtext($1))', [
          `rentme:migrations:${dbSchema}`,
        ])
        .catch(() => undefined)
    }
    client?.release()
    await pool.end()
  }
}

run().catch((error) => {
  console.error('[migration-error]', error)
  process.exitCode = 1
})
