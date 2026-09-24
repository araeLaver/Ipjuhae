/**
 * lib/db-ssl.mjs — hostname별 SSL 판단 고정 (DOW-1152).
 *
 * 회귀 기준: `localhost` / `127.0.0.1` / compose 서비스명 `db`는 SSL 없이 붙고,
 * 원격 호스트만 SSL이 켜진다. 예전 구현은 연결 문자열에 'localhost'가 들어있는지로
 * 판단해서 127.0.0.1과 db가 SSL로 넘어가 연결이 끊겼다.
 */
import { describe, expect, it } from 'vitest'
import { getDatabaseHostname, isLocalDatabaseHost, resolveDbSsl } from '@/lib/db-ssl.mjs'

const LOCAL = 'postgresql://ipjuhae:pw@localhost:5432/ipjuhae_db'
const LOOPBACK_IP = 'postgresql://ipjuhae:pw@127.0.0.1:5432/ipjuhae_db'
const COMPOSE = 'postgresql://ipjuhae:pw@db:5432/ipjuhae_db'
const REMOTE = 'postgresql://user:pw@ep-cool-name.ap-northeast-2.aws.neon.tech:5432/ipjuhae_db'

describe('resolveDbSsl — hostname 기준 자동 판단', () => {
  it('localhost는 SSL을 끈다', () => {
    expect(resolveDbSsl(LOCAL, { env: {} })).toBe(false)
  })

  it('127.0.0.1도 SSL을 끈다 — localhost와 같은 곳을 가리킨다', () => {
    expect(resolveDbSsl(LOOPBACK_IP, { env: {} })).toBe(false)
  })

  it('compose 서비스명 db는 SSL을 끈다 — stock postgres 이미지에는 TLS가 없다', () => {
    expect(resolveDbSsl(COMPOSE, { env: {} })).toBe(false)
  })

  it('원격 호스트는 SSL을 켠다', () => {
    expect(resolveDbSsl(REMOTE, { env: {} })).toEqual({ rejectUnauthorized: false })
  })

  it('원격 호스트에서 rejectUnauthorized 기본값이 전달된다', () => {
    expect(resolveDbSsl(REMOTE, { env: {}, rejectUnauthorized: true })).toEqual({
      rejectUnauthorized: true,
    })
  })

  it('연결 문자열이 없으면 원격으로 보고 SSL을 켠다', () => {
    expect(resolveDbSsl(undefined, { env: {} })).toEqual({ rejectUnauthorized: false })
  })

  it('URL로 해석되지 않으면 원격으로 보고 SSL을 켠다', () => {
    expect(resolveDbSsl('not a url', { env: {} })).toEqual({ rejectUnauthorized: false })
  })
})

describe('resolveDbSsl — 명시적 스위치', () => {
  it('DATABASE_SSL=disable이면 원격이어도 SSL을 끈다', () => {
    expect(resolveDbSsl(REMOTE, { env: { DATABASE_SSL: 'disable' } })).toBe(false)
  })

  it('DATABASE_SSL=require면 로컬이어도 SSL을 켠다', () => {
    expect(resolveDbSsl(LOCAL, { env: { DATABASE_SSL: 'require' } })).toEqual({
      rejectUnauthorized: false,
    })
  })

  it('DATABASE_SSL=verify-full은 인증서를 검증한다', () => {
    expect(resolveDbSsl(REMOTE, { env: { DATABASE_SSL: 'verify-full' } })).toEqual({
      rejectUnauthorized: true,
    })
  })

  it('require는 호출부의 검증 강도를 따른다 — 운영 런타임에서 느슨해지지 않는다', () => {
    expect(resolveDbSsl(REMOTE, { env: { PGSSLMODE: 'require' }, rejectUnauthorized: true })).toEqual({
      rejectUnauthorized: true,
    })
  })

  it('no-verify는 호출부 기본값과 무관하게 검증을 끈다', () => {
    expect(
      resolveDbSsl(REMOTE, { env: { DATABASE_SSL: 'no-verify' }, rejectUnauthorized: true }),
    ).toEqual({ rejectUnauthorized: false })
  })

  it('PGSSLMODE도 인정한다', () => {
    expect(resolveDbSsl(REMOTE, { env: { PGSSLMODE: 'disable' } })).toBe(false)
  })

  it('DATABASE_SSL이 PGSSLMODE보다 우선한다', () => {
    expect(resolveDbSsl(REMOTE, { env: { DATABASE_SSL: 'disable', PGSSLMODE: 'require' } })).toBe(
      false,
    )
  })

  it('연결 문자열의 sslmode 쿼리도 읽는다', () => {
    expect(resolveDbSsl(`${LOCAL}?sslmode=require`, { env: {} })).toEqual({
      rejectUnauthorized: false,
    })
    expect(resolveDbSsl(`${REMOTE}?sslmode=disable`, { env: {} })).toBe(false)
  })

  it('환경변수가 연결 문자열 sslmode보다 우선한다', () => {
    expect(resolveDbSsl(`${REMOTE}?sslmode=require`, { env: { DATABASE_SSL: 'disable' } })).toBe(
      false,
    )
  })

  it('빈 문자열이나 모르는 값은 무시하고 hostname으로 판단한다', () => {
    expect(resolveDbSsl(LOCAL, { env: { DATABASE_SSL: '' } })).toBe(false)
    expect(resolveDbSsl(REMOTE, { env: { DATABASE_SSL: 'maybe' } })).toEqual({
      rejectUnauthorized: false,
    })
    expect(resolveDbSsl(LOCAL, { env: { DATABASE_SSL: 'maybe' } })).toBe(false)
  })
})

describe('isLocalDatabaseHost', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal', 'db', 'postgres'])(
    '%s는 로컬로 본다',
    (host) => {
      expect(isLocalDatabaseHost(host)).toBe(true)
    },
  )

  it.each(['ep-cool-name.ap-northeast-2.aws.neon.tech', 'ipjuhae-db.internal', '10.0.0.5'])(
    '%s는 원격으로 본다',
    (host) => {
      expect(isLocalDatabaseHost(host)).toBe(false)
    },
  )

  it('빈 값은 원격으로 본다', () => {
    expect(isLocalDatabaseHost(null)).toBe(false)
    expect(isLocalDatabaseHost('')).toBe(false)
  })
})

describe('getDatabaseHostname', () => {
  it('연결 문자열에서 hostname을 뽑는다', () => {
    expect(getDatabaseHostname(LOCAL)).toBe('localhost')
    expect(getDatabaseHostname(COMPOSE)).toBe('db')
  })

  it('해석할 수 없으면 null', () => {
    expect(getDatabaseHostname('not a url')).toBeNull()
    expect(getDatabaseHostname(undefined)).toBeNull()
  })
})
