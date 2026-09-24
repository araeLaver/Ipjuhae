import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, authRateLimit, apiRateLimit, getClientIp } from '@/lib/rate-limit'

describe('rateLimit', () => {
  beforeEach(() => {
    // 테스트마다 고유 키 사용하여 격리
    vi.useFakeTimers()
  })

  it('제한 내 요청 허용', () => {
    const key = `test-${Date.now()}-allow`
    const result = rateLimit(key, { limit: 5, windowMs: 60000 })
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('제한 도달시 거부', () => {
    const key = `test-${Date.now()}-limit`
    const config = { limit: 3, windowMs: 60000 }

    rateLimit(key, config) // 1
    rateLimit(key, config) // 2
    rateLimit(key, config) // 3

    const result = rateLimit(key, config) // 4번째 - 거부
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('윈도우 만료 후 카운터 리셋', () => {
    const key = `test-${Date.now()}-reset`
    const config = { limit: 2, windowMs: 1000 }

    rateLimit(key, config) // 1
    rateLimit(key, config) // 2

    let result = rateLimit(key, config) // 거부
    expect(result.success).toBe(false)

    // 1초 후
    vi.advanceTimersByTime(1001)

    result = rateLimit(key, config) // 리셋되어 허용
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('remaining 카운트 정확', () => {
    const key = `test-${Date.now()}-count`
    const config = { limit: 5, windowMs: 60000 }

    expect(rateLimit(key, config).remaining).toBe(4)
    expect(rateLimit(key, config).remaining).toBe(3)
    expect(rateLimit(key, config).remaining).toBe(2)
    expect(rateLimit(key, config).remaining).toBe(1)
    expect(rateLimit(key, config).remaining).toBe(0)
  })
})

describe('authRateLimit', () => {
  it('분당 10회 제한', () => {
    const ip = `192.168.1.${Date.now() % 255}`

    for (let i = 0; i < 10; i++) {
      expect(authRateLimit(ip).success).toBe(true)
    }

    expect(authRateLimit(ip).success).toBe(false)
  })
})

describe('apiRateLimit', () => {
  it('분당 60회 제한', () => {
    const ip = `10.0.0.${Date.now() % 255}`

    for (let i = 0; i < 60; i++) {
      expect(apiRateLimit(ip).success).toBe(true)
    }

    expect(apiRateLimit(ip).success).toBe(false)
  })
})

describe('getClientIp', () => {
  it('x-forwarded-for 헤더에서 첫 번째 IP 추출', () => {
    const request = {
      headers: new Headers({
        'x-forwarded-for': '203.0.113.1, 70.41.3.18, 150.172.238.178',
      }),
    } as unknown as Request

    expect(getClientIp(request)).toBe('203.0.113.1')
  })

  it('x-real-ip 헤더에서 IP 추출', () => {
    const request = {
      headers: new Headers({
        'x-real-ip': '203.0.113.50',
      }),
    } as unknown as Request

    expect(getClientIp(request)).toBe('203.0.113.50')
  })

  it('헤더 없으면 127.0.0.1 반환', () => {
    const request = {
      headers: new Headers({}),
    } as unknown as Request

    expect(getClientIp(request)).toBe('127.0.0.1')
  })

  it('x-forwarded-for가 x-real-ip보다 우선', () => {
    const request = {
      headers: new Headers({
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '203.0.113.50',
      }),
    } as unknown as Request

    expect(getClientIp(request)).toBe('203.0.113.1')
  })

  // DOW-1165: x-forwarded-for 맨 앞 값은 클라이언트가 실어 보낼 수 있고 Fly Proxy는
  // 거기에 덧붙이기만 한다. 그 값을 키로 쓰면 요청마다 헤더를 바꿔 한도를 빠져나간다.
  it('fly-client-ip가 위조 가능한 x-forwarded-for·x-real-ip를 모두 앞지른다', () => {
    const request = {
      headers: new Headers({
        'fly-client-ip': '198.51.100.7',
        'x-forwarded-for': '203.0.113.1, 198.51.100.7',
        'x-real-ip': '203.0.113.50',
      }),
    } as unknown as Request

    expect(getClientIp(request)).toBe('198.51.100.7')
  })

  it('공격자가 x-forwarded-for를 바꿔도 fly-client-ip가 같으면 같은 키가 된다', () => {
    const spoofs = ['1.1.1.1', '2.2.2.2', '3.3.3.3']
    const ips = spoofs.map(
      (spoof) =>
        getClientIp({
          headers: new Headers({
            'fly-client-ip': '198.51.100.9',
            'x-forwarded-for': `${spoof}, 198.51.100.9`,
          }),
        } as unknown as Request)
    )

    expect(new Set(ips).size).toBe(1)
    expect(ips[0]).toBe('198.51.100.9')
  })
})
