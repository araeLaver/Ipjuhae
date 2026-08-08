import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

import PublicMockListingsPage from '@/app/demo/public-mock/listings/page'
import { publicMockListings } from '@/lib/public-mock-listings'

const pageSource = readFileSync(resolve(process.cwd(), 'app/demo/public-mock/listings/page.tsx'), 'utf8')
const fixtureSource = readFileSync(resolve(process.cwd(), 'lib/public-mock-listings.ts'), 'utf8')

describe('synthetic public mock demo 비공개 경계', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('production에서 opt-in flag가 있어도 route를 항상 404로 폐쇄한다', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PUBLIC_MOCK_DEMO_ENABLED', '1')

    expect(() => PublicMockListingsPage()).toThrow('NEXT_NOT_FOUND')
  })

  it('local/test에서도 명시적 opt-in 없이 route를 폐쇄한다', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PUBLIC_MOCK_DEMO_ENABLED', '')

    expect(() => PublicMockListingsPage()).toThrow('NEXT_NOT_FOUND')
  })

  it('local/test에서 명시적으로 opt-in한 경우에만 fixture 화면을 생성한다', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('PUBLIC_MOCK_DEMO_ENABLED', '1')

    expect(PublicMockListingsPage()).toBeTruthy()
  })

  it('fixture는 실제 사용자 식별자와 상세 주소를 포함하지 않는다', () => {
    const serialized = JSON.stringify(publicMockListings)

    expect(serialized).not.toMatch(/\b\d{5}\b/) // 우편번호
    expect(serialized).not.toMatch(/\b\d{1,4}(?:-가|나|다)?번지\b/)
    expect(serialized).not.toMatch(/\b\d{1,4}동\s*\d{1,4}호\b/)
    expect(serialized).not.toMatch(/01[016789]-?\d{3,4}-?\d{4}/)
    expect(serialized).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
    expect(publicMockListings.every(({ id }) => id.startsWith('demo-'))).toBe(true)
  })

  it('fixture와 demo 화면에 오인 가능한 판단·확정 표현을 두지 않는다', () => {
    const content = `${JSON.stringify(publicMockListings)}\n${pageSource}`

    for (const phrase of ['신용점수', '신용평가', '중개 확정']) {
      expect(content).not.toContain(phrase)
    }
    expect(content).not.toMatch(/보증(?!금)/)
  })

  it('local-only fixture만 import하고 외부 image·API·DB·secret 호출을 포함하지 않는다', () => {
    const implementation = `${pageSource}\n${fixtureSource}`

    expect(pageSource).toContain("from '@/lib/public-mock-listings'")
    expect(implementation).not.toMatch(/\b(?:fetch|axios)\s*\(/)
    expect(implementation).not.toMatch(/from ['"]@\/lib\/(?:db|supabase|storage|upload|stripe)['"]/)
    expect(implementation).not.toMatch(/process\.env\.(?!NODE_ENV|PUBLIC_MOCK_DEMO_ENABLED)/)
    expect(implementation).not.toMatch(/<Image\b|https?:\/\//)
  })
})
