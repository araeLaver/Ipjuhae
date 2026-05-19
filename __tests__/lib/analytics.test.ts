import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}))

import { trackServer } from '@/lib/analytics'
import { query } from '@/lib/db'

describe('server analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ANALYTICS_LOG_DB_ERRORS
  })

  it('swallows DB persistence failures without logging in test/local fallback mode', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(query).mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND db'))

    await expect(trackServer('page_view', { path: '/login' })).resolves.toBeUndefined()

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO analytics_events'),
      ['page_view', JSON.stringify({ path: '/login' }), null, null],
    )
    expect(consoleError).not.toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('can opt back into DB failure logging for diagnostics', async () => {
    process.env.ANALYTICS_LOG_DB_ERRORS = 'true'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('connection refused')
    vi.mocked(query).mockRejectedValueOnce(error)

    await trackServer('page_view')

    expect(consoleError).toHaveBeenCalledWith(
      '[analytics:trackServer] failed to track event',
      'page_view',
      error,
    )

    consoleError.mockRestore()
  })
})
