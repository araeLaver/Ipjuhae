import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

import { createDisclosurePackage } from '@/lib/trust-engine'
import { query, queryOne, transaction } from '@/lib/db'

const previousSigningKey = process.env.DISCLOSURE_SIGNING_KEY

describe('trust disclosure signing', () => {
  afterEach(() => {
    vi.clearAllMocks()
    if (previousSigningKey === undefined) {
      delete process.env.DISCLOSURE_SIGNING_KEY
    } else {
      process.env.DISCLOSURE_SIGNING_KEY = previousSigningKey
    }
  })

  it('fails before database access when the dedicated signing key is missing', async () => {
    delete process.env.DISCLOSURE_SIGNING_KEY

    await expect(
      createDisclosurePackage(
        {
          subjectType: 'tenant',
          subjectId: '11111111-1111-4111-8111-111111111111',
          recipientId: '22222222-2222-4222-8222-222222222222',
          recipientRole: 'landlord',
          transactionId: '33333333-3333-4333-8333-333333333333',
          purpose: 'contract review',
          consentId: '44444444-4444-4444-8444-444444444444',
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow('DISCLOSURE_SIGNING_KEY_NOT_CONFIGURED')
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('rejects a short disclosure signing key', async () => {
    process.env.DISCLOSURE_SIGNING_KEY = 'too-short'

    await expect(
      createDisclosurePackage(
        {
          subjectType: 'tenant',
          subjectId: '11111111-1111-4111-8111-111111111111',
          recipientId: '22222222-2222-4222-8222-222222222222',
          recipientRole: 'landlord',
          transactionId: '33333333-3333-4333-8333-333333333333',
          purpose: 'contract review',
          consentId: '44444444-4444-4444-8444-444444444444',
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toThrow('DISCLOSURE_SIGNING_KEY_NOT_CONFIGURED')
    expect(queryOne).not.toHaveBeenCalled()
  })

  it('binds disclosure verification level to selected policy and stored package payload', async () => {
    process.env.DISCLOSURE_SIGNING_KEY = 'a'.repeat(64)

    const transactionQueries: Array<{ sql: string; params: unknown[] }> = []
    vi.mocked(query).mockImplementation(async (sql: string) => {
      if (sql.includes('field_name = ANY($3::text[])')) {
        return [
          { subject_type: 'landlord', field_name: 'identity_verified', normalized_value: true },
          { subject_type: 'landlord', field_name: 'owner_matched', normalized_value: true },
        ]
      }
      if (sql.includes('FROM trust_fact_nodes') && !sql.includes('field_name = ANY($3::text[])')) {
        return [
          {
            id: '66666666-6666-6666-8666-666666666666',
            evidence_id: '77777777-7777-7777-8777-777777777777',
            field_name: 'identity_verified',
            normalized_value: true,
            value_digest: 'digest',
            quality: 1,
            valid_until: null,
            reason_codes: [] as string[],
          },
        ]
      }
      return []
    })
    vi.mocked(queryOne)
      .mockResolvedValueOnce({
        id: '33333333-3333-3333-8333-333333333333',
        stage: 'S3',
        status: 'active',
        landlord_id: '11111111-1111-4111-8111-111111111111',
        tenant_id: '22222222-2222-4222-8222-222222222222',
        realtor_id: null,
        property_id: null,
        evaluation_flags: {},
        dispute_meta: {},
      })
      .mockResolvedValueOnce({
        id: '44444444-4444-4444-8444-444444444444',
        version: 'minimum-claims-1.0',
        verification_level: 2,
        ttl_minutes: 60,
        claim_rules: {
          claims: [{ fact: 'identity_verified', claim: 'identity_verified', representation: 'boolean' }],
        },
      })
      .mockResolvedValueOnce({
        id: '55555555-5555-5555-8555-555555555555',
        user_id: '22222222-2222-4222-8222-222222222222',
        allowed_fields: { all: true },
      })

    vi.mocked(transaction).mockImplementation(async (handler) => {
      const client = {
        query: vi.fn(async (sql: string, params: unknown[] = []) => {
          transactionQueries.push({ sql, params })
          if (sql.includes('INSERT INTO trust_derived_nodes')) {
            return { rows: [{ id: '88888888-8888-8888-8888-888888888888' }] }
          }
          if (sql.includes('SELECT id, derived_node_id FROM trust_score_runs')) {
            return { rows: [{ id: '99999999-9999-9999-8999-999999999999', derived_node_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }] }
          }
          if (sql.includes('INSERT INTO trust_disclosure_packages')) {
            return { rows: [{ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }] }
          }
          return { rows: [] }
        }),
      }

      return handler(client as never)
    })

    await createDisclosurePackage({
      subjectType: 'tenant',
      subjectId: '22222222-2222-4222-8222-222222222222',
      recipientId: '11111111-1111-4111-8111-111111111111',
      recipientRole: 'landlord',
      transactionId: '33333333-3333-3333-8333-333333333333',
      purpose: 'tenant_profile_view',
      consentId: '55555555-5555-5555-8555-555555555555',
    }, '22222222-2222-4222-8222-222222222222')

    const policyLookup = vi.mocked(queryOne).mock.calls[1]
    expect(Array.isArray(policyLookup?.[1]) ? policyLookup[1][4] : undefined).toBe(1)

    const disclosureInsert = transactionQueries.find((entry) => entry.sql.includes('INSERT INTO trust_disclosure_packages'))
    expect(disclosureInsert?.params[8]).toBe(1)

    const scoreDependency = transactionQueries.find((entry) => entry.sql.includes('INSERT INTO trust_dependency_edges'))
    expect(scoreDependency).toBeDefined()
  })

  it('falls back to zero-level policy when verification facts are unavailable', async () => {
    process.env.DISCLOSURE_SIGNING_KEY = 'b'.repeat(64)

    vi.mocked(query).mockImplementation(async (sql: string) => {
      if (sql.includes('field_name = ANY($3::text[])')) {
        return []
      }
      if (sql.includes('FROM trust_fact_nodes') && !sql.includes('field_name = ANY($3::text[])')) {
        return [
          {
            id: '66666666-6666-6666-8666-666666666666',
            evidence_id: '77777777-7777-7777-8777-777777777777',
            field_name: 'identity_verified',
            normalized_value: true,
            value_digest: 'digest',
            quality: 1,
            valid_until: null,
            reason_codes: [] as string[],
          },
        ]
      }
      return []
    })
    vi.mocked(queryOne)
      .mockResolvedValueOnce({
        id: '33333333-3333-3333-8333-333333333333',
        stage: 'S3',
        status: 'active',
        landlord_id: '11111111-1111-4111-8111-111111111111',
        tenant_id: '22222222-2222-4222-8222-222222222222',
        realtor_id: null,
        property_id: null,
        evaluation_flags: {},
        dispute_meta: {},
      })
      .mockResolvedValueOnce({
        id: '44444444-4444-4444-8444-444444444444',
        version: 'minimum-claims-1.0',
        verification_level: 0,
        ttl_minutes: 60,
        claim_rules: {
          claims: [{ fact: 'identity_verified', claim: 'identity_verified', representation: 'boolean' }],
        },
      })
      .mockResolvedValueOnce({
        id: '55555555-5555-5555-8555-555555555555',
        user_id: '22222222-2222-4222-8222-222222222222',
        allowed_fields: { all: true },
      })

    vi.mocked(transaction).mockImplementation(async (handler) => {
      const client = {
        query: vi.fn(async (sql: string, params: unknown[] = []) => {
          if (sql.includes('INSERT INTO trust_derived_nodes')) {
            return { rows: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }] }
          }
          if (sql.includes('INSERT INTO trust_disclosure_packages')) {
            return { rows: [{ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' }] }
          }
          return { rows: [] }
        }),
      }
      return handler(client as never)
    })

    await createDisclosurePackage({
      subjectType: 'tenant',
      subjectId: '22222222-2222-4222-8222-222222222222',
      recipientId: '11111111-1111-4111-8111-111111111111',
      recipientRole: 'landlord',
      transactionId: '33333333-3333-3333-8333-333333333333',
      purpose: 'tenant_profile_view',
      consentId: '55555555-5555-5555-8555-555555555555',
    }, '22222222-2222-4222-8222-222222222222')

    const policyLookup = vi.mocked(queryOne).mock.calls[1]
    expect(Array.isArray(policyLookup?.[1]) ? policyLookup[1][4] : undefined).toBe(0)
  })
})
