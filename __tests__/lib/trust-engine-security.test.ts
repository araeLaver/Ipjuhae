import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
}))

import { createDisclosurePackage } from '@/lib/trust-engine'
import { queryOne } from '@/lib/db'

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
        '11111111-1111-4111-8111-111111111111'
      )
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
        '11111111-1111-4111-8111-111111111111'
      )
    ).rejects.toThrow('DISCLOSURE_SIGNING_KEY_NOT_CONFIGURED')
    expect(queryOne).not.toHaveBeenCalled()
  })
})
