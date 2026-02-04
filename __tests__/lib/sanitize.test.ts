import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeUserInput,
  sanitizeObject,
} from '@/lib/sanitize'

describe('escapeHtml', () => {
  it('HTML 특수문자 이스케이프', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    )
  })

  it('일반 텍스트는 그대로 유지', () => {
    expect(escapeHtml('안녕하세요')).toBe('안녕하세요')
  })

  it('앰퍼샌드 이스케이프', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })
})

describe('stripHtml', () => {
  it('HTML 태그 제거', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello')
    expect(stripHtml('<b>Bold</b> text')).toBe('Bold text')
  })

  it('중첩된 태그 제거', () => {
    expect(stripHtml('<div><span>Nested</span></div>')).toBe('Nested')
  })

  it('태그 없는 텍스트는 그대로', () => {
    expect(stripHtml('Plain text')).toBe('Plain text')
  })
})

describe('sanitizeString', () => {
  it('script 태그 제거', () => {
    expect(sanitizeString('<script>alert("xss")</script>Hello')).toBe('Hello')
    expect(sanitizeString('Hello<script>evil()</script>World')).toBe('HelloWorld')
  })

  it('on* 이벤트 핸들러 제거', () => {
    expect(sanitizeString('<img src="x" onerror="alert(1)">')).toBe('')
    expect(sanitizeString('onclick="evil()"')).toBe('')
  })

  it('javascript: 프로토콜 제거', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeString('<a href="javascript:void(0)">link</a>')).toBe('link')
  })

  it('일반 텍스트는 유지', () => {
    expect(sanitizeString('안녕하세요. 반갑습니다.')).toBe('안녕하세요. 반갑습니다.')
  })

  it('빈 값 처리', () => {
    expect(sanitizeString('')).toBe('')
    expect(sanitizeString(null as unknown as string)).toBe('')
    expect(sanitizeString(undefined as unknown as string)).toBe('')
  })
})

describe('sanitizeUserInput', () => {
  it('과도한 공백 정리', () => {
    expect(sanitizeUserInput('Hello    World')).toBe('Hello World')
    expect(sanitizeUserInput('  앞뒤 공백  ')).toBe('앞뒤 공백')
  })

  it('연속된 줄바꿈 정리', () => {
    expect(sanitizeUserInput('Line1\n\n\n\n\nLine2')).toBe('Line1\n\nLine2')
  })

  it('XSS 공격 방지', () => {
    expect(sanitizeUserInput('<script>alert("xss")</script>')).toBe('')
    expect(sanitizeUserInput('Normal text<script>evil()</script>')).toBe('Normal text')
  })
})

describe('sanitizeObject', () => {
  it('객체의 문자열 값 sanitize', () => {
    const input = {
      name: '  홍길동  ',
      bio: '<script>alert(1)</script>안녕하세요',
      age: 30,
    }

    const result = sanitizeObject(input)

    expect(result.name).toBe('홍길동')
    expect(result.bio).toBe('안녕하세요')
    expect(result.age).toBe(30)
  })

  it('중첩된 객체 처리', () => {
    const input = {
      user: {
        name: '<b>홍길동</b>',
        email: 'test@example.com',
      },
    }

    const result = sanitizeObject(input)

    expect(result.user.name).toBe('홍길동')
    expect(result.user.email).toBe('test@example.com')
  })
})
