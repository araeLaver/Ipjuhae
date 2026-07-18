import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(),
}))

import { query } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import {
  dispatchTrustOutbox,
  TRUST_NOTIFICATION_EVENT_TYPES,
} from '@/lib/trust-outbox'

const baseEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  aggregate_type: 'score_run',
  aggregate_id: '22222222-2222-4222-8222-222222222222',
  payload: {},
  attempts: 1,
}

describe('trust notification outbox dispatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(createNotification).mockResolvedValue(undefined)
  })

  it('claims only event types handled by the notification dispatcher', async () => {
    vi.mocked(query).mockResolvedValueOnce([])

    await expect(dispatchTrustOutbox(500)).resolves.toEqual({
      claimed: 0,
      published: 0,
      failed: 0,
    })

    expect(query).toHaveBeenCalledOnce()
    expect(String(vi.mocked(query).mock.calls[0]?.[0])).toContain(
      'event_type = ANY($2::text[])',
    )
    expect(vi.mocked(query).mock.calls[0]?.[1]).toEqual([
      100,
      [...TRUST_NOTIFICATION_EVENT_TYPES],
    ])
    expect(
      (TRUST_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(
        'ExternalVerificationRequested',
      ),
    ).toBe(false)
  })

  it('leaves an unsupported event unpublished if one is returned unexpectedly', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([
        {
          ...baseEvent,
          aggregate_type: 'external_request',
          event_type: 'ExternalVerificationRequested',
        },
      ])
      .mockResolvedValueOnce([])

    await expect(dispatchTrustOutbox()).resolves.toEqual({
      claimed: 1,
      published: 0,
      failed: 1,
    })

    expect(createNotification).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(2)
    expect(String(vi.mocked(query).mock.calls[1]?.[0])).toContain(
      "last_error = 'OUTBOX_HANDLER_UNAVAILABLE'",
    )
    expect(String(vi.mocked(query).mock.calls[1]?.[0])).not.toContain(
      'published_at = NOW()',
    )
  })

  it('delivers and publishes a supported notification event', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce([
        {
          ...baseEvent,
          event_type: 'ScoreCalculated',
          payload: {
            subject_id: '33333333-3333-4333-8333-333333333333',
          },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    await expect(dispatchTrustOutbox()).resolves.toEqual({
      claimed: 1,
      published: 1,
      failed: 0,
    })

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '33333333-3333-4333-8333-333333333333',
        metadata: {
          trust_event_id: baseEvent.id,
          event_type: 'ScoreCalculated',
        },
      }),
    )
    expect(String(vi.mocked(query).mock.calls[1]?.[0])).toContain(
      'INSERT INTO trust_delivery_receipts',
    )
    expect(String(vi.mocked(query).mock.calls[2]?.[0])).toContain(
      'published_at = NOW()',
    )
  })
})
