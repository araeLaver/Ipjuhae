/**
 * 유입 경로 수집 — first-touch 유지와 "빈 칸만 채우기"를 고정한다.
 *
 * 모집 링크를 뿌리는 쪽은 `?from=cafe`가 조용히 사라져도 알아챌 방법이 없다.
 * 어느 채널이 살아있는지를 이 값으로 판단하므로, 아래 두 성질을 같이 못박는다.
 *
 * 1. 이미 잡힌 first-touch 값은 나중 페이지가 덮지 않는다
 * 2. 아직 비어 있는 칸은 나중에라도 채운다
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAttribution, sanitizeTag } from '@/lib/attribution'

const STORAGE_KEY = 'ipjuhae:attribution'

/** window.location.search와 document.referrer를 원하는 값으로 세운다. */
function visit(search: string, referrer = ''): void {
  vi.stubGlobal('window', {
    location: { search, hostname: 'www.ipjuhae.com' },
    sessionStorage: store,
  })
  vi.stubGlobal('document', { referrer })
}

let store: Storage

function makeStore(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
}

describe('getAttribution', () => {
  beforeEach(() => {
    store = makeStore()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('첫 진입의 유입 값을 읽어 저장한다', () => {
    visit('?from=cafe&utm_source=naver')

    expect(getAttribution()).toMatchObject({ from: 'cafe', utm_source: 'naver' })
    expect(store.getItem(STORAGE_KEY)).toContain('cafe')
  })

  it('나중 페이지가 first-touch 값을 덮지 않는다', () => {
    visit('?from=cafe')
    getAttribution()

    // 같은 탭에서 다른 채널 태그를 달고 이동해도 최초 값이 남아야 한다.
    visit('?from=instagram')
    expect(getAttribution().from).toBe('cafe')
  })

  it('비어 있던 from은 나중 페이지에서 채운다 — QA가 지적한 누락 경로', () => {
    // 1. 카페 글 링크로 랜딩(/) 진입 → referrer_host만 잡힌다
    visit('', 'https://cafe.naver.com/some-post')
    const first = getAttribution()
    expect(first.referrer_host).toBe('cafe.naver.com')
    expect(first.from).toBeNull()

    // 2. 사이트 안에서 /check?from=cafe 로 이동
    visit('?from=cafe', 'https://cafe.naver.com/some-post')
    const second = getAttribution()

    expect(second.from).toBe('cafe')
    // 먼저 잡힌 값은 그대로다.
    expect(second.referrer_host).toBe('cafe.naver.com')
  })

  it('빈 칸을 채우면 그 결과가 저장돼 다음 호출에도 남는다', () => {
    visit('', 'https://cafe.naver.com/p')
    getAttribution()

    visit('?from=cafe', 'https://cafe.naver.com/p')
    getAttribution()

    // 쿼리가 없는 페이지로 옮겨가도 채워진 값이 유지된다.
    visit('', 'https://cafe.naver.com/p')
    expect(getAttribution().from).toBe('cafe')
  })

  it('같은 사이트에서 넘어온 referrer는 유입으로 보지 않는다', () => {
    visit('', 'https://www.ipjuhae.com/home')
    expect(getAttribution().referrer_host).toBeNull()
  })

  it('아무 유입 정보가 없으면 전부 null이고 저장도 하지 않는다', () => {
    visit('')

    expect(getAttribution()).toEqual({
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      referrer_host: null,
      from: null,
    })
    expect(store.getItem(STORAGE_KEY)).toBeNull()
  })

  it('서버에서는 빈 값을 돌려준다', () => {
    vi.stubGlobal('window', undefined)

    expect(getAttribution().from).toBeNull()
  })
})

describe('sanitizeTag', () => {
  it('제어문자를 지우고 64자에서 자른다', () => {
    expect(sanitizeTag('ca\u0000fe')).toBe('cafe')
    expect(sanitizeTag('x'.repeat(80))).toHaveLength(64)
  })

  it('빈 값과 문자열이 아닌 값은 null', () => {
    expect(sanitizeTag('   ')).toBeNull()
    expect(sanitizeTag(null)).toBeNull()
    expect(sanitizeTag(undefined)).toBeNull()
  })
})
