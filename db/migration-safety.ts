export const BASELINE_MIGRATION = 'schema.sql'

export const CORE_TABLES = [
  'users',
  'profiles',
  'properties',
  'listings',
  'conversations',
] as const

export type MigrationBaselineState = 'empty' | 'tracked'

export interface MigrationInventory {
  tableNames: string[]
  trackingTableExists: boolean
  appliedMigrations: string[]
}

export interface MigrationBaselineAssessment {
  state: MigrationBaselineState
  existingCoreTables: string[]
}

export class MigrationSafetyError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_SCHEMA_IDENTIFIER'
      | 'UNTRACKED_EXISTING_DATABASE'
      | 'INCONSISTENT_DATABASE_STATE',
    message: string
  ) {
    super(message)
    this.name = 'MigrationSafetyError'
  }
}

/**
 * Only accept ordinary PostgreSQL identifiers. Dynamic SQL still quotes the
 * result, but this validation keeps configuration mistakes and SQL fragments
 * out of identifier positions entirely.
 */
export function validateSchemaIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new MigrationSafetyError(
      'INVALID_SCHEMA_IDENTIFIER',
      `DB_SCHEMA must be a PostgreSQL identifier, received ${JSON.stringify(value)}`
    )
  }

  return value
}

export function quoteIdentifier(value: string): string {
  return `"${validateSchemaIdentifier(value)}"`
}

/**
 * Decide whether migrations may run without making any database changes.
 *
 * Allowed states are intentionally narrow:
 * - an actually empty schema (or an empty tracking table left by setup), or
 * - a database with at least one known core table and an explicit schema.sql
 *   baseline record.
 *
 * Everything else is ambiguous and therefore fails closed.
 */
export function assessMigrationBaseline(
  inventory: MigrationInventory
): MigrationBaselineAssessment {
  const tableNames = new Set(inventory.tableNames)
  const existingCoreTables = CORE_TABLES.filter((table) => tableNames.has(table))
  const nonTrackingTables = inventory.tableNames.filter(
    (table) => table !== '_migrations'
  )
  const hasBaseline = inventory.appliedMigrations.includes(BASELINE_MIGRATION)
  const trackingTableListed = tableNames.has('_migrations')

  if (
    trackingTableListed !== inventory.trackingTableExists ||
    (!inventory.trackingTableExists && inventory.appliedMigrations.length > 0)
  ) {
    throw new MigrationSafetyError(
      'INCONSISTENT_DATABASE_STATE',
      'Migration tracking metadata is internally inconsistent; refusing to infer a baseline.'
    )
  }

  if (existingCoreTables.length > 0) {
    if (!inventory.trackingTableExists || !hasBaseline) {
      throw new MigrationSafetyError(
        'UNTRACKED_EXISTING_DATABASE',
        `Existing core tables (${existingCoreTables.join(', ')}) require an ` +
          `${BASELINE_MIGRATION} record in _migrations before any migration can run.`
      )
    }

    return { state: 'tracked', existingCoreTables: [...existingCoreTables] }
  }

  const emptyTrackingTable =
    inventory.trackingTableExists && inventory.appliedMigrations.length === 0

  if (
    nonTrackingTables.length === 0 &&
    (!inventory.trackingTableExists || emptyTrackingTable)
  ) {
    return { state: 'empty', existingCoreTables: [] }
  }

  throw new MigrationSafetyError(
    'INCONSISTENT_DATABASE_STATE',
    'The schema is neither empty nor a normally tracked database; refusing to infer a baseline.'
  )
}

export function pendingMigrations(
  knownMigrations: readonly string[],
  appliedMigrations: readonly string[]
): string[] {
  const applied = new Set(appliedMigrations)
  return knownMigrations.filter((migration) => !applied.has(migration))
}
