import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatDistanceToNow,
  formatDate,
  formatDateTime,
  formatTime,
  isToday,
  formatMessageDate,
} from '@/lib/date'

describe('formatDistanceToNow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('방금 전 - 60초 미만', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const recent = new Date('2024-06-15T11:59:45Z') // 15초 전
    expect(formatDistanceToNow(recent)).toBe('방금 전')
  })

  it('방금 전 - Date 문자열도 지원', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const recent = '2024-06-15T11:59:50Z' // 10초 전
    expect(formatDistanceToNow(recent)).toBe('방금 전')
  })

  it('N분 전 - 60분 미만', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const fiveMinAgo = new Date('2024-06-15T11:55:00Z')
    expect(formatDistanceToNow(fiveMinAgo)).toBe('5분 전')
  })

  it('N분 전 - 59분', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const fiftyNineMinAgo = new Date('2024-06-15T11:01:00Z')
    expect(formatDistanceToNow(fiftyNineMinAgo)).toBe('59분 전')
  })

  it('N시간 전 - 24시간 미만', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const threeHoursAgo = new Date('2024-06-15T09:00:00Z')
    expect(formatDistanceToNow(threeHoursAgo)).toBe('3시간 전')
  })

  it('N일 전 - 7일 미만', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const threeDaysAgo = new Date('2024-06-12T12:00:00Z')
    expect(formatDistanceToNow(threeDaysAgo)).toBe('3일 전')
  })

  it('N주 전 - 4주 미만', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const twoWeeksAgo = new Date('2024-06-01T12:00:00Z')
    expect(formatDistanceToNow(twoWeeksAgo)).toBe('2주 전')
  })

  it('N개월 전 - 12개월 미만', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const threeMonthsAgo = new Date('2024-03-15T12:00:00Z') // ~91일
    expect(formatDistanceToNow(threeMonthsAgo)).toBe('3개월 전')
  })

  it('N년 전 - 1년 이상', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00Z')
    vi.setSystemTime(now)
    const twoYearsAgo = new Date('2022-06-15T12:00:00Z')
    expect(formatDistanceToNow(twoYearsAgo)).toBe('2년 전')
  })
})

describe('formatDate', () => {
  it('날짜 객체를 한국어 형식으로 포맷', () => {
    const date = new Date('2024-01-15T00:00:00')
    const result = formatDate(date)
    // 로케일 포맷 검증 - '2024'와 '1'과 '15'를 포함해야 함
    expect(result).toContain('2024')
    expect(result).toContain('1')
    expect(result).toContain('15')
  })

  it('날짜 문자열도 지원', () => {
    const result = formatDate('2024-06-15')
    expect(result).toContain('2024')
    expect(result).toContain('6')
    expect(result).toContain('15')
  })

  it('반환값이 문자열', () => {
    expect(typeof formatDate(new Date())).toBe('string')
  })
})

describe('formatDateTime', () => {
  it('날짜와 시간을 한국어 형식으로 포맷', () => {
    const date = new Date('2024-01-15T15:30:00')
    const result = formatDateTime(date)
    expect(result).toContain('2024')
    expect(result).toContain('1')
    expect(result).toContain('15')
  })

  it('날짜 문자열도 지원', () => {
    const result = formatDateTime('2024-06-15T10:00:00')
    expect(result).toContain('2024')
    expect(typeof result).toBe('string')
  })

  it('반환값이 문자열', () => {
    expect(typeof formatDateTime(new Date())).toBe('string')
  })
})

describe('formatTime', () => {
  it('시간을 한국어 형식으로 포맷', () => {
    const date = new Date('2024-01-15T15:30:00')
    const result = formatTime(date)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('날짜 문자열도 지원', () => {
    const result = formatTime('2024-06-15T09:05:00')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('isToday', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘 날짜는 true 반환', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T10:00:00')
    vi.setSystemTime(now)
    expect(isToday(new Date('2024-06-15T08:00:00'))).toBe(true)
  })

  it('오늘 자정 직후도 true 반환', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T23:59:00')
    vi.setSystemTime(now)
    expect(isToday(new Date('2024-06-15T00:01:00'))).toBe(true)
  })

  it('어제 날짜는 false 반환', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T10:00:00')
    vi.setSystemTime(now)
    expect(isToday(new Date('2024-06-14T10:00:00'))).toBe(false)
  })

  it('내일 날짜는 false 반환', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T10:00:00')
    vi.setSystemTime(now)
    expect(isToday(new Date('2024-06-16T10:00:00'))).toBe(false)
  })

  it('다른 연도는 false 반환', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T10:00:00')
    vi.setSystemTime(now)
    expect(isToday(new Date('2023-06-15T10:00:00'))).toBe(false)
  })

  it('날짜 문자열도 지원', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T10:00:00')
    vi.setSystemTime(now)
    expect(isToday('2024-06-15T10:00:00')).toBe(true)
    expect(isToday('2024-06-14T10:00:00')).toBe(false)
  })
})

describe('formatMessageDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘 메시지는 시간만 표시', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00')
    vi.setSystemTime(now)
    const todayMsg = new Date('2024-06-15T09:30:00')
    const result = formatMessageDate(todayMsg)
    // formatTime과 동일한 결과여야 함
    expect(result).toBe(formatTime(todayMsg))
  })

  it('오늘이 아닌 메시지는 날짜 표시', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00')
    vi.setSystemTime(now)
    const oldMsg = new Date('2024-06-10T09:30:00')
    const result = formatMessageDate(oldMsg)
    // formatDate와 동일한 결과여야 함
    expect(result).toBe(formatDate(oldMsg))
  })

  it('어제 메시지는 날짜를 포함', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00')
    vi.setSystemTime(now)
    const yesterday = new Date('2024-06-14T10:00:00')
    const result = formatMessageDate(yesterday)
    expect(result).toContain('2024')
    expect(result).toContain('6')
    expect(result).toContain('14')
  })

  it('날짜 문자열도 지원', () => {
    vi.useFakeTimers()
    const now = new Date('2024-06-15T12:00:00')
    vi.setSystemTime(now)
    const result = formatMessageDate('2024-06-15T08:00:00')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
