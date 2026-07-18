import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}))

vi.mock('@/lib/request-context', () => ({
  getRequestContext: vi.fn(() => ({
    requestId: 'request-1',
    traceId: 'trace-1',
  })),
}))

import { withIdempotency } from '@/lib/idempotency'
import { query, queryOne } from '@/lib/db'

const reservedAt = new Date('2026-07-17T08:00:00.000Z')

function request() {
  return new Request('http://localhost/api/v1/test', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'retryable-key',
    },
    body: JSON.stringify({ value: 1 }),
  })
}

function requestAt(path: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': 'retryable-key',
    },
    body: JSON.stringify({ value: 1 }),
  })
}

async function hashFor(input: Request) {
  const url = new URL(input.url)
  const body = await input.clone().arrayBuffer()
  return createHash('sha256')
    .update(input.method)
    .update('\n')
    .update(url.pathname)
    .update('\n')
    .update(Buffer.from(body))
    .digest('hex')
}

describe('withIdempotency response caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        idempotency_key: 'retryable-key',
        created_at: reservedAt,
      } as never)
  })

  it('releases a reserved key for an explicitly non-cacheable status', async () => {
    const response = await withIdempotency({
      request: request(),
      namespace: 'compliance-test',
      key: 'retryable-key',
      nonCacheableStatuses: [503],
      handler: async () => NextResponse.json(
        { code: 'COMPLIANCE_GATE_NOT_APPROVED' },
        { status: 503 },
      ),
    })

    expect(response.status).toBe(503)
    const scopedKey = vi.mocked(queryOne).mock.calls[0]?.[1]?.[1]
    expect(scopedKey).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(scopedKey).not.toBe('retryable-key')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AND in_progress = TRUE'),
      expect.arrayContaining(['compliance-test', scopedKey, reservedAt]),
    )
    expect(vi.mocked(query).mock.calls[0]?.[0]).not.toContain('UPDATE api_idempotency_requests')
  })

  it('continues to cache statuses that were not opted out', async () => {
    const response = await withIdempotency({
      request: request(),
      namespace: 'compliance-test',
      key: 'retryable-key',
      nonCacheableStatuses: [503],
      handler: async () => NextResponse.json({ ok: true }, { status: 201 }),
    })

    expect(response.status).toBe(201)
    const scopedKey = vi.mocked(queryOne).mock.calls[0]?.[1]?.[1]
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE api_idempotency_requests'),
      expect.arrayContaining([201, 'compliance-test', scopedKey, reservedAt]),
    )
  })

  it('reserves an expired key with a conditional atomic upsert', async () => {
    const expired = {
      idempotency_key: 'retryable-key',
      request_hash: 'old-hash',
      in_progress: false,
      response_status: 200,
      expires_at: new Date('2026-07-16T00:00:00.000Z'),
    }
    vi.mocked(queryOne)
      .mockReset()
      .mockResolvedValueOnce(expired as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...expired,
        created_at: reservedAt,
        in_progress: true,
        response_status: null,
      } as never)

    await withIdempotency({
      request: request(),
      namespace: 'compliance-test',
      key: 'retryable-key',
      handler: async () => NextResponse.json({ ok: true }, { status: 201 }),
    })

    const reservationSql = String(vi.mocked(queryOne).mock.calls[2]?.[0])
    expect(reservationSql).toContain('ON CONFLICT (namespace, idempotency_key) DO UPDATE')
    expect(reservationSql).toContain('WHERE api_idempotency_requests.expires_at <= NOW()')
    expect(reservationSql).toContain("NOW() + make_interval(mins => $7::int)")
    expect(vi.mocked(queryOne).mock.calls[2]?.[1]?.[6]).toBe(120)
    expect(query).not.toHaveBeenCalledWith(
      expect.stringMatching(/^DELETE FROM api_idempotency_requests/),
      expect.anything(),
    )
  })

  it('derives different storage keys for the same supplied key across actors', async () => {
    vi.mocked(queryOne)
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ created_at: reservedAt } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ created_at: reservedAt } as never)

    await withIdempotency({
      request: request(),
      namespace: 'actor-scope-test',
      key: 'shared-client-key',
      actorUserId: '11111111-1111-4111-8111-111111111111',
      handler: async () => NextResponse.json({ actor: 1 }, { status: 201 }),
    })
    await withIdempotency({
      request: request(),
      namespace: 'actor-scope-test',
      key: 'shared-client-key',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      handler: async () => NextResponse.json({ actor: 2 }, { status: 201 }),
    })

    const firstActorKey = vi.mocked(queryOne).mock.calls[0]?.[1]?.[1]
    const secondActorKey = vi.mocked(queryOne).mock.calls[3]?.[1]?.[1]
    expect(firstActorKey).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(secondActorKey).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(firstActorKey).not.toBe(secondActorKey)
  })

  it('scopes anonymous keys by path so different reference tokens cannot collide', async () => {
    vi.mocked(queryOne)
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ created_at: reservedAt } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ created_at: reservedAt } as never)

    await withIdempotency({
      request: requestAt('/api/references/verify/token-a'),
      namespace: 'reference-submit',
      key: 'shared-client-key',
      handler: async () => NextResponse.json({ token: 'a' }, { status: 201 }),
    })
    await withIdempotency({
      request: requestAt('/api/references/verify/token-b'),
      namespace: 'reference-submit',
      key: 'shared-client-key',
      handler: async () => NextResponse.json({ token: 'b' }, { status: 201 }),
    })

    const firstTokenKey = vi.mocked(queryOne).mock.calls[0]?.[1]?.[1]
    const secondTokenKey = vi.mocked(queryOne).mock.calls[3]?.[1]?.[1]
    expect(firstTokenKey).not.toBe(secondTokenKey)
  })

  it('honors an unexpired legacy plaintext record for the same actor during rollout', async () => {
    const legacyRequest = request()
    const handler = vi.fn(async () =>
      NextResponse.json({ should_not_run: true }, { status: 201 }),
    )
    vi.mocked(queryOne)
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        actor_user_id: '11111111-1111-4111-8111-111111111111',
        request_hash: await hashFor(legacyRequest),
        in_progress: false,
        response_status: 201,
        response_body: { legacy: true },
        expires_at: new Date('2099-01-01T00:00:00.000Z'),
        expired: false,
      } as never)

    const response = await withIdempotency({
      request: legacyRequest,
      namespace: 'rollout-test',
      key: 'retryable-key',
      actorUserId: '11111111-1111-4111-8111-111111111111',
      handler,
    })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ legacy: true })
    expect(handler).not.toHaveBeenCalled()
    expect(vi.mocked(queryOne).mock.calls[1]?.[1]).toEqual([
      'rollout-test',
      'retryable-key',
    ])
  })
})
