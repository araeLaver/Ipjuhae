import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  default: { connect: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/trust-score-recalculator', () => ({
  recalculateTrustScores: vi.fn(),
}))

import { GET } from '@/app/api/cron/trust-disclosures/route'
import { query } from '@/lib/db'
import { recalculateTrustScores } from '@/lib/trust-score-recalculator'

const previousCronSecret = process.env.CRON_SECRET

function request(token?: string) {
  return new Request('http://localhost:3000/api/cron/trust-disclosures', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
}

describe('GET /api/cron/trust-disclosures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    vi.mocked(recalculateTrustScores).mockResolvedValue([])
  })

  afterEach(() => {
    process.env.CRON_SECRET = previousCronSecret
  })

  it('CRON_SECRET 없이 호출하면 처리하지 않는다', async () => {
    const res = await GET(request('wrong-secret'))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
    expect(query).not.toHaveBeenCalled()
  })

  it('만료된 검증값, 동의, 리포트 번들, 공개결정을 회수한다', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000001',
          owner_user_id: '00000000-0000-4000-8000-000000000011',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000021',
          owner_user_id: '00000000-0000-4000-8000-000000000011',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000031',
          disclosure_decision_id: '00000000-0000-4000-8000-000000000041',
          owner_user_id: '00000000-0000-4000-8000-000000000011',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000032',
          disclosure_decision_id: '00000000-0000-4000-8000-000000000042',
          owner_user_id: '00000000-0000-4000-8000-000000000011',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '00000000-0000-4000-8000-000000000033',
          disclosure_decision_id: '00000000-0000-4000-8000-000000000043',
          owner_user_id: '00000000-0000-4000-8000-000000000011',
        },
      ])
      .mockResolvedValueOnce([
        { id: '00000000-0000-4000-8000-000000000041' },
        { id: '00000000-0000-4000-8000-000000000042' },
      ])
      .mockResolvedValueOnce([
        { id: '00000000-0000-4000-8000-000000000043' },
      ])

    const res = await GET(request('cron-secret'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      ok: true,
      expiredValidationValues: 1,
      expiredConsents: 1,
      expiredReportBundles: 3,
      expiredDisclosureDecisions: 3,
      recalculatedUsers: 1,
    })
    expect(query).toHaveBeenCalledTimes(7)
    expect(recalculateTrustScores).toHaveBeenCalledWith(['00000000-0000-4000-8000-000000000011'])
  })
})
