import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'

describe('logger PII redaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('redacts sensitive nested metadata and formatted Error strings in production logs', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('request failed for user@example.com token=secret-token')
    error.stack = [
      'Error: request failed for user@example.com token=secret-token',
      '    at handler (/app/route.ts:1:1)',
    ].join('\n')

    logger.error('qa user@example.com token=message-token', {
      email: 'user@example.com',
      phoneNumber: '01012345678',
      nested: {
        contact: 'manager@example.com',
        detail: 'authorization=Bearer abc.def.ghi',
      },
      error,
    })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const entry = JSON.parse(String(errorSpy.mock.calls[0][0]))
    const serialized = JSON.stringify(entry)

    expect(entry.message).toBe('qa u***@example.com token=***')
    expect(entry.meta.email).toBe('u***@example.com')
    expect(entry.meta.phoneNumber).toBe('***5678')
    expect(entry.meta.nested.contact).toBe('m***@example.com')
    expect(entry.meta.error.message).toBe('request failed for u***@example.com token=***')
    expect(entry.meta.error.stack).toContain('u***@example.com token=***')
    expect(serialized).not.toContain('user@example.com')
    expect(serialized).not.toContain('manager@example.com')
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('message-token')
    expect(serialized).not.toContain('abc.def.ghi')
  })

  it('uses redacted metadata in development logs', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.info('qa', {
      email: 'user@example.com',
      token: 'secret-token',
      nested: { message: 'contact user@example.com token=secret-token' },
    })

    expect(infoSpy).toHaveBeenCalledTimes(1)
    const [message, meta] = infoSpy.mock.calls[0]
    const serialized = JSON.stringify({ message, meta })

    expect(message).toBe('[INFO] qa')
    expect(meta).toEqual({
      email: 'u***@example.com',
      token: '***',
      nested: { message: 'contact u***@example.com token=***' },
    })
    expect(serialized).not.toContain('user@example.com')
    expect(serialized).not.toContain('secret-token')
  })
})
