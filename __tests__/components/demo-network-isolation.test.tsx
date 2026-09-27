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

/**
 * 대조군 경로 — demo 격리 대상이 **아닌** 살아 있는 경로여야 한다.
 *
 * 전에는 `/home`이었다. 그 화면은 `/`로 영구 리다이렉트되며 제거됐다
 * ([DOW-1183](/DOW/issues/DOW-1183)). 죽은 주소를 대조군으로 두면
 * `isDemoIsolatedPath`가 어떻게 바뀌어도 대조군이 계속 통과해서,
 * "감시기가 살아 있음"을 증명하려던 이 대조군 자체가 증명을 못 하게 된다.
 *
 * `/check`를 쓴다. DB에 의존하지 않고, PWA start_url이라 없어질 가능성이 가장 낮다.
 */
const CONTROL_PATH = '/check'

let currentPathname: string = CONTROL_PATH

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
  currentPathname = CONTROL_PATH
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

/**
 * 아래 두 대조군은 **증명하는 것이 다르다.** 변이로 확인한 결과다
 * (`scripts/dow-1174-control-mutation.mjs`, [DOW-1174](/DOW/issues/DOW-1174)).
 *
 * **[DOW-1221](/DOW/issues/DOW-1221)에서 바뀌었다.** 이제 두 대조군 모두 경로 판정을 탄다
 * (`Header`의 `/api/auth/me`를 `isDemoIsolatedPath` 게이트 아래로 넣었다).
 * `/check`를 격리 대상에 넣는 변이를 걸면 **둘 다 빨개진다.**
 *
 * 예전에는 두 번째가 `Header`의 무조건 `fetch`를 타서, `isDemoIsolatedPath`가 어떻게
 * 바뀌든 — CONTROL_PATH가 죽은 주소가 돼도 — 계속 통과했다. `/home`이 삭제됐을 때
 * 이 테스트가 아무것도 알려주지 못한 이유다. 그 구멍은 이제 없다.
 *
 * 증명하는 것은 여전히 다르다. 첫 번째는 `Providers`의 analytics 경로를, 두 번째는
 * `PageContainer` → `Header`의 auth 경로를 지킨다. 한쪽만 남기지 말 것.
 */
describe('감시기 대조군 — network 관측이 실제로 동작하는지 먼저 증명한다', () => {
  // 경로 대조군: CONTROL_PATH가 살아 있고 격리 대상이 아님을 증명한다.
  it('일반 경로에서 Providers를 마운트하면 analytics 호출이 관측된다', async () => {
    currentPathname = CONTROL_PATH

    render(<Providers><div>본문</div></Providers>)
    await flush()

    expect(observedRequests()).toContain('/api/analytics/event')
  })

  // 감시기 대조군: fetch 가로채기가 동작함을 증명한다.
  // DOW-1221 이후로는 경로 대조군이기도 하다 — Header가 게이트를 타므로
  // CONTROL_PATH가 격리 대상이 되면 이 테스트도 빨개진다.
  it('일반 경로에서 PageContainer를 마운트하면 auth 조회가 관측된다 — fetch 감시기 확인', async () => {
    currentPathname = CONTROL_PATH

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

  // 아래 두 건이 DOW-1221이 막는 구멍이다. header.tsx의 isIsolated 게이트를 지우면
  // 둘 다 '/api/auth/me'를 관측하고 빨개진다. 위의 기존 5건은 그래도 통과한다 —
  // demo 화면이 PageContainer를 안 쓰는 관례로만 피하고 있었기 때문이다.
  it('demo 경로에서 PageContainer를 마운트해도 auth 조회가 나가지 않는다', async () => {
    currentPathname = DEMO_PATH

    render(<PageContainer><div>demo 본문</div></PageContainer>)
    await flush()

    expect(observedRequests()).toEqual([])
  })

  it('demo 하위 경로 전체에서 공통 shell이 auth 조회를 하지 않는다', async () => {
    for (const pathname of ['/demo', '/demo/public-mock/listings', '/demo/새경로']) {
      cleanup()
      fetchSpy.mockClear()
      sendBeaconSpy.mockClear()
      xhrOpenSpy.mockClear()
      currentPathname = pathname

      render(<PageContainer><div>본문</div></PageContainer>)
      await flush()

      expect(observedRequests(), `${pathname}에서 network 호출 발생`).toEqual([])
    }
  })
})
