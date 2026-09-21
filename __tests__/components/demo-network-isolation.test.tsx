// @vitest-environment jsdom
/**
 * demo route 네트워크 격리 회귀 테스트.
 *
 * 왜 소스 grep이 아니라 실제 render인가:
 * 이 결함은 두 번 다 transitive import를 타고 들어왔다. `page.tsx`에는 `fetch(`가 없고
 * `PageContainer` → `/api/auth/me`, root `Providers` → `PageViewTracker` →
 * `analytics-client` → `navigator.sendBeacon('/api/analytics/event')` 경로로 샜다.
 * 파일 두 개의 텍스트만 정규식으로 보는 테스트는 고치지 않아도 통과한다
 * (`__tests__/lib/public-mock-demo-boundary.test.ts`가 실제로 6 pass인 채 결함을 놓쳤다).
 *
 * 그래서 여기서는 컴포넌트를 실제로 마운트하고 network 진입점을 전부 감시한다.
 * 감시기가 살아 있다는 것 자체를 증명하려고 "호출이 나야 정상인" 대조군을 같이 둔다.
 * 대조군이 통과하지 못하면 격리 단언은 의미가 없으므로 같이 깨진다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

let currentPathname = '/home'

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

import { Providers } from '@/components/providers'
import { PageContainer } from '@/components/layout/page-container'
import PublicMockListingsPage from '@/app/demo/public-mock/listings/page'

const DEMO_PATH = '/demo/public-mock/listings'

let fetchSpy: ReturnType<typeof vi.fn>
let sendBeaconSpy: ReturnType<typeof vi.fn>
let xhrOpenSpy: ReturnType<typeof vi.fn>

/** render 중 발생한 모든 network 진입점 호출의 대상 URL 목록. */
function observedRequests(): string[] {
  return [
    ...fetchSpy.mock.calls.map((call) => String(call[0])),
    ...sendBeaconSpy.mock.calls.map((call) => String(call[0])),
    ...xhrOpenSpy.mock.calls.map((call) => String(call[1])),
  ]
}

/** microtask/effect flush — useEffect 안에서 시작되는 호출까지 관측한다. */
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  currentPathname = '/home'
  vi.stubEnv('PUBLIC_MOCK_DEMO_ENABLED', '1')

  fetchSpy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
  sendBeaconSpy = vi.fn(() => true)
  xhrOpenSpy = vi.fn()

  vi.stubGlobal('fetch', fetchSpy)
  Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeaconSpy, configurable: true, writable: true })
  XMLHttpRequest.prototype.open = xhrOpenSpy as unknown as XMLHttpRequest['open']

  if (!window.matchMedia) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('감시기 대조군 — network 관측이 실제로 동작하는지 먼저 증명한다', () => {
  it('일반 경로에서 Providers를 마운트하면 analytics 호출이 관측된다', async () => {
    currentPathname = '/home'

    render(<Providers><div>본문</div></Providers>)
    await flush()

    expect(observedRequests()).toContain('/api/analytics/event')
  })

  it('PageContainer를 마운트하면 auth 조회가 관측된다', async () => {
    render(<PageContainer><div>본문</div></PageContainer>)
    await flush()

    expect(observedRequests()).toContain('/api/auth/me')
  })
})

describe('demo route 격리 — 실제 render에서 network 호출이 0건이어야 한다', () => {
  it('demo 경로에서는 Providers가 analytics tracker를 마운트하지 않는다', async () => {
    currentPathname = DEMO_PATH

    render(<Providers><div>demo 본문</div></Providers>)
    await flush()

    expect(observedRequests()).toEqual([])
  })

  it('demo 화면을 root client 경계까지 포함해 마운트해도 network 호출이 없다', async () => {
    currentPathname = DEMO_PATH

    const { getByText } = render(<Providers>{PublicMockListingsPage()}</Providers>)
    await flush()

    // 화면이 실제로 그려졌는지 확인한다. render가 조용히 실패하면 "호출 0건"은 거짓 안심이다.
    expect(getByText('외부 공개 전 검수용 mock 매물 화면')).toBeInTheDocument()
    expect(observedRequests()).toEqual([])
  })

  it('demo 화면은 auth 조회를 하는 공통 shell에 의존하지 않는다', async () => {
    currentPathname = DEMO_PATH

    render(<div>{PublicMockListingsPage()}</div>)
    await flush()

    expect(observedRequests()).toEqual([])
  })

  it('demo 하위 경로 전체에 격리가 적용된다', async () => {
    for (const pathname of ['/demo', '/demo/public-mock/listings', '/demo/새경로']) {
      cleanup()
      fetchSpy.mockClear()
      sendBeaconSpy.mockClear()
      xhrOpenSpy.mockClear()
      currentPathname = pathname

      render(<Providers><div>본문</div></Providers>)
      await flush()

      expect(observedRequests(), `${pathname}에서 network 호출 발생`).toEqual([])
    }
  })
})
