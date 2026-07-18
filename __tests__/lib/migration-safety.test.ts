import { describe, expect, it } from 'vitest'
import {
  assessMigrationBaseline,
  MigrationSafetyError,
  pendingMigrations,
  quoteIdentifier,
  validateSchemaIdentifier,
} from '@/db/migration-safety'

describe('migration safety policy', () => {
  describe('schema identifier validation', () => {
    it('accepts and quotes an ordinary PostgreSQL identifier', () => {
      expect(validateSchemaIdentifier('ipjuhae_prod2')).toBe('ipjuhae_prod2')
      expect(quoteIdentifier('ipjuhae_prod2')).toBe('"ipjuhae_prod2"')
    })

    it.each(['', 'ipjuhae-prod', 'ipjuhae public', 'x; DROP SCHEMA public'])(
      'rejects unsafe identifier %j',
      (identifier) => {
        expect(() => validateSchemaIdentifier(identifier)).toThrow(
          MigrationSafetyError
        )
      }
    )
  })

  describe('baseline assessment', () => {
    it('allows a brand-new empty schema', () => {
      expect(
        assessMigrationBaseline({
          tableNames: [],
          trackingTableExists: false,
          appliedMigrations: [],
        })
      ).toEqual({ state: 'empty', existingCoreTables: [] })
    })

    it('allows recovery from an empty tracking table with no application tables', () => {
      expect(
        assessMigrationBaseline({
          tableNames: ['_migrations'],
          trackingTableExists: true,
          appliedMigrations: [],
        })
      ).toEqual({ state: 'empty', existingCoreTables: [] })
    })

    it('allows a tracked database with an explicit schema baseline', () => {
      expect(
        assessMigrationBaseline({
          tableNames: ['_migrations', 'users', 'profiles'],
          trackingTableExists: true,
          appliedMigrations: ['schema.sql', 'migration-001-magic-link.sql'],
        })
      ).toEqual({
        state: 'tracked',
        existingCoreTables: ['users', 'profiles'],
      })
    })

    it('blocks existing core tables when the tracking table is missing', () => {
      expect(() =>
        assessMigrationBaseline({
          tableNames: ['users'],
          trackingTableExists: false,
          appliedMigrations: [],
        })
      ).toThrowError(
        expect.objectContaining({ code: 'UNTRACKED_EXISTING_DATABASE' })
      )
    })

    it('blocks existing core tables when schema.sql was not recorded', () => {
      expect(() =>
        assessMigrationBaseline({
          tableNames: ['_migrations', 'users'],
          trackingTableExists: true,
          appliedMigrations: ['migration-001-magic-link.sql'],
        })
      ).toThrowError(
        expect.objectContaining({ code: 'UNTRACKED_EXISTING_DATABASE' })
      )
    })

    it('blocks a non-empty state that cannot be proven safe', () => {
      expect(() =>
        assessMigrationBaseline({
          tableNames: ['legacy_imports'],
          trackingTableExists: false,
          appliedMigrations: [],
        })
      ).toThrowError(
        expect.objectContaining({ code: 'INCONSISTENT_DATABASE_STATE' })
      )
    })

    it('blocks inconsistent tracking metadata', () => {
      expect(() =>
        assessMigrationBaseline({
          tableNames: ['users'],
          trackingTableExists: true,
          appliedMigrations: ['schema.sql'],
        })
      ).toThrowError(
        expect.objectContaining({ code: 'INCONSISTENT_DATABASE_STATE' })
      )
    })

    it('blocks a baseline record when no known core table exists', () => {
      expect(() =>
        assessMigrationBaseline({
          tableNames: ['_migrations'],
          trackingTableExists: true,
          appliedMigrations: ['schema.sql'],
        })
      ).toThrowError(
        expect.objectContaining({ code: 'INCONSISTENT_DATABASE_STATE' })
      )
    })
  })

  it('produces a deterministic pending migration plan', () => {
    expect(
      pendingMigrations(
        ['schema.sql', 'migration-001.sql', 'migration-002.sql'],
        ['schema.sql', 'migration-002.sql']
      )
    ).toEqual(['migration-001.sql'])
  })
})
