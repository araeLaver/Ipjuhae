/**
 * demo route 격리 경계 — 단일 판정 지점.
 *
 * `/demo/*` 화면은 외부 제출용 캡처 후보를 만드는 용도라서 "운영 API를 호출하지 않는다"는
 * 고지를 화면에 싣는다. 그 고지가 사실이려면 root layout에 매달린 클라이언트 훅
 * (PageViewTracker, ServiceWorkerRegistrar 등)이 이 경로에서 네트워크를 건드리면 안 된다.
 *
 * 경로 판정을 여기 한 곳에만 두는 이유: 컴포넌트마다 `startsWith('/demo')`를 흩뿌리면
 * 새 훅이 추가될 때 조용히 빠지고, 그러면 고지가 다시 거짓이 된다.
 */

export const DEMO_ISOLATED_PATH_PREFIX = '/demo'

/** 네트워크 격리를 적용해야 하는 경로인지 판정한다. */
export function isDemoIsolatedPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string' || pathname.length === 0) return false
  return pathname === DEMO_ISOLATED_PATH_PREFIX || pathname.startsWith(`${DEMO_ISOLATED_PATH_PREFIX}/`)
}
