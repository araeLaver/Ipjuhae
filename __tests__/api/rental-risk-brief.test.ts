import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/rental-risk/brief/route'

describe('POST /api/rental-risk/brief', () => {
  it('returns a fixture-backed public-data risk brief', async () => {
    const response = await POST(new Request('http://localhost/api/rental-risk/brief', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        address: '서울 강남구 대치동 316',
        complexName: '은마아파트',
        areaM2: 84.43,
        depositManwon: 56500,
        monthlyRentManwon: 0,
      }),
    }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ match: { grade: 'exact' }, sourceAsOf: '2026-08-01' })
  })

  it('rejects invalid values', async () => {
    const response = await POST(new Request('http://localhost/api/rental-risk/brief', {
      method: 'POST',
      body: JSON.stringify({ address: '', areaM2: -1 }),
    }))
    expect(response.status).toBe(400)
  })
})
