import { describe, expect, it } from 'vitest'
import { syntheticDemoListings } from '../synthetic-demo-listings'

describe('synthetic demo listings', () => {
  it('uses stable synthetic ids and abbreviated legal-dong addresses', () => {
    for (const listing of syntheticDemoListings) {
      expect(listing.id).toMatch(/^demo-/)
      expect(listing.area).not.toMatch(/\d/)
      expect(listing.area).not.toMatch(/(로|길)\s|번지|우편번호|아파트\s*\d|동\s*\d+호/)
    }
  })

  it('does not contain remote assets or risky evaluation language', () => {
    const fixture = JSON.stringify(syntheticDemoListings)

    expect(fixture).not.toMatch(/https?:\/\//)
    expect(fixture).not.toMatch(/추천|신뢰점수|신용평가|자동\s*심사|보증|중개|법률\s*판단/)
  })
})
