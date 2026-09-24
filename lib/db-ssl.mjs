/**
 * Postgres SSL 판단을 한 곳에 모은 헬퍼 (DOW-1152).
 *
 * 예전에는 연결 문자열에 `'localhost'` 문자열이 들어있는지로 SSL 여부를 정했다.
 * 그래서 같은 곳을 가리키는 `127.0.0.1`이나 compose 서비스명 `db`로 붙으면
 * SSL이 켜지고, TLS가 없는 stock `postgres:16-alpine`은 연결을 끊었다.
 * ("The server does not support SSL connections")
 *
 * 판단 순서:
 *   1. `DATABASE_SSL` 환경변수 (명시적 스위치, 최우선)
 *   2. `PGSSLMODE` 환경변수 (libpq 관례)
 *   3. 연결 문자열의 `?sslmode=` 쿼리 파라미터
 *   4. hostname 기준 자동 판단 (loopback / 단일 라벨 호스트면 SSL 끔)
 *
 * `.ts`(lib/db.ts, db/migrate.ts …)와 `node`로 직접 도는 `.mjs` 스크립트가
 * 같이 써야 하므로 일부러 plain ESM(`.mjs`)으로 둔다. TS 쪽은 `allowJs` +
 * JSDoc으로 타입이 잡힌다.
 */

/** 항상 SSL 없이 붙는 호스트 (loopback / 도커 호스트 브리지). */
const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'host.docker.internal',
])

/** `sslmode` 값 → SSL 설정. `undefined`면 "모르는 값"이라 자동 판단으로 넘긴다. */
function sslFromMode(rawMode, rejectUnauthorized) {
  const mode = String(rawMode).trim().toLowerCase()
  if (mode === '') return undefined

  if (['disable', 'disabled', 'false', 'off', 'no', '0'].includes(mode)) return false
  if (['verify-ca', 'verify-full'].includes(mode)) return { rejectUnauthorized: true }
  if (mode === 'no-verify') return { rejectUnauthorized: false }
  if (['require', 'prefer', 'allow', 'true', 'on', 'yes', '1'].includes(mode)) {
    // 검증 강도는 호출부 기본값을 따른다. 운영 런타임은 true, 일회성 스크립트는 false.
    return { rejectUnauthorized }
  }
  return undefined
}

/**
 * 연결 문자열에서 hostname을 뽑는다. 해석 실패하면 `null`.
 *
 * @param {string | undefined | null} connectionString
 * @returns {string | null}
 */
export function getDatabaseHostname(connectionString) {
  if (!connectionString) return null
  try {
    const hostname = new URL(connectionString).hostname
    return hostname === '' ? null : hostname
  } catch {
    return null
  }
}

/**
 * 이 호스트가 "SSL 없이 붙는 로컬/컨테이너 내부 DB"인지.
 *
 * - loopback 계열(`localhost`, `127.0.0.1`, `::1` …)
 * - 점이 없는 단일 라벨 호스트(`db`, `postgres` 같은 compose 서비스명).
 *   공인 DNS에는 단일 라벨 이름이 없으므로 컨테이너 네트워크 내부로 본다.
 *
 * @param {string | null | undefined} hostname
 * @returns {boolean}
 */
export function isLocalDatabaseHost(hostname) {
  if (!hostname) return false
  const host = hostname.toLowerCase()
  if (LOCAL_HOSTNAMES.has(host)) return true
  return !host.includes('.') && !host.includes(':')
}

/**
 * pg `Pool`/`Client`에 넘길 `ssl` 값을 결정한다.
 *
 * @param {string | undefined | null} connectionString
 * @param {{ env?: Record<string, string | undefined>, rejectUnauthorized?: boolean }} [options]
 *   `rejectUnauthorized`는 SSL을 켤 때 인증서를 검증할지에 대한 기본값이다.
 *   운영 런타임은 `true`, 일회성 스크립트는 `false`를 쓴다.
 * @returns {false | { rejectUnauthorized: boolean }}
 */
export function resolveDbSsl(connectionString, options = {}) {
  const env = options.env ?? process.env
  const rejectUnauthorized = options.rejectUnauthorized ?? false

  for (const candidate of [env.DATABASE_SSL, env.PGSSLMODE]) {
    if (candidate === undefined || candidate === null) continue
    const resolved = sslFromMode(candidate, rejectUnauthorized)
    if (resolved !== undefined) return resolved
  }

  if (connectionString) {
    try {
      const urlMode = new URL(connectionString).searchParams.get('sslmode')
      if (urlMode !== null) {
        const resolved = sslFromMode(urlMode, rejectUnauthorized)
        if (resolved !== undefined) return resolved
      }
    } catch {
      // URL로 해석 못 하면 아래 hostname 판단으로 넘어간다.
    }
  }

  const hostname = getDatabaseHostname(connectionString)
  if (hostname === null) {
    // 연결 문자열이 없거나(= pg가 PG* 환경변수로 붙는 경우) 해석 불가.
    // 원격일 수 있으므로 SSL을 켜 둔다.
    return { rejectUnauthorized }
  }

  return isLocalDatabaseHost(hostname) ? false : { rejectUnauthorized }
}
