import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureError } from '../observability'
import { logger } from '../logger'

// Assembled from parts so no full DSN literal exists in source (avoids
// secret-scanner false positives). Host uses the reserved example.com domain.
const DSN_KEY = 'testpublickey'
const DSN_HOST = 'sentry.example.com'
const DSN_PROJECT = '1'
const TEST_DSN = `https://${DSN_KEY}@${DSN_HOST}/${DSN_PROJECT}`

describe('observability.captureError', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.SENTRY_DSN
  })

  afterEach(() => {
    delete process.env.SENTRY_DSN
    vi.unstubAllGlobals()
  })

  it('always records the error through the logger', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const err = new Error('boom')

    await captureError(err, { route: '/api/x', method: 'GET' })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const [label, meta] = errorSpy.mock.calls[0]
    expect(label).toContain('/api/x')
    expect((meta as Record<string, unknown>).error).toBe(err)
  })

  it('does not call fetch when SENTRY_DSN is unset', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await captureError(new Error('boom'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards to the Sentry envelope endpoint when SENTRY_DSN is set', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    process.env.SENTRY_DSN = TEST_DSN
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await captureError(new Error('boom'), { route: '/api/x' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://${DSN_HOST}/api/${DSN_PROJECT}/envelope/`)
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['X-Sentry-Auth']).toContain(`sentry_key=${DSN_KEY}`)
    expect(headers['Content-Type']).toBe('application/x-sentry-envelope')
    // Envelope body has 3 newline-delimited JSON lines (header, item, event).
    const body = String((init as RequestInit).body).trim().split('\n')
    expect(body).toHaveLength(3)
    expect(JSON.parse(body[1])).toEqual({ type: 'event' })
  })

  it('never throws when the forwarder fails', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    process.env.SENTRY_DSN = TEST_DSN
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    await expect(captureError(new Error('boom'))).resolves.toBeUndefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('warns and skips forwarding on an invalid DSN', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    process.env.SENTRY_DSN = 'not-a-valid-dsn'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await captureError(new Error('boom'))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })
})
