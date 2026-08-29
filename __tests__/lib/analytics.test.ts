import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { trackServer } from '@/lib/analytics'
import { query } from '@/lib/db'
import { logger } from '@/lib/logger'

describe('server analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ANALYTICS_LOG_DB_ERRORS
  })

  it('swallows DB persistence failures without logging in test/local fallback mode', async () => {
    const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {})
    vi.mocked(query).mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND db'))

    await expect(trackServer('page_view', { path: '/login' })).resolves.toBeUndefined()

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      ['page_view', JSON.stringify({ path: '/login' }), null, null],
    )
    expect(loggerError).not.toHaveBeenCalled()

    loggerError.mockRestore()
  })

  it('can opt back into DB failure logging for diagnostics', async () => {
    process.env.ANALYTICS_LOG_DB_ERRORS = 'true'
    const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const error = new Error('connection refused')
    vi.mocked(query).mockRejectedValueOnce(error)

    await trackServer('page_view')

    expect(loggerError).toHaveBeenCalledWith(
      '[analytics:trackServer] failed to track event',
      { event: 'page_view', error },
    )

    loggerError.mockRestore()
  })
})
