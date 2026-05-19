import { describe, expect, it } from 'vitest'
import { decodeTenantCursor, encodeTenantCursor } from '@/lib/tenant-search-cursor'

describe('landlord tenant search cursor helpers', () => {
  it('round-trips cursor payloads for supported sort modes', () => {
    const cursor = encodeTenantCursor('reference_desc', 3, 'profile-1')

    expect(decodeTenantCursor(cursor)).toEqual({
      sort: 'reference_desc',
      value: 3,
      id: 'profile-1',
    })
  })

  it('rejects malformed cursor payloads', () => {
    expect(decodeTenantCursor('not-base64-json')).toBeNull()

    const unsupportedSort = Buffer.from(
      JSON.stringify({ sort: 'name_asc', value: 'Kim', id: 'profile-2' })
    ).toString('base64')

    expect(decodeTenantCursor(unsupportedSort)).toBeNull()
  })
})
