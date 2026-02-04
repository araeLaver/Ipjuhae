/**
 * XSS 방지를 위한 입력값 sanitization 유틸리티
 */

/**
 * HTML 특수문자 이스케이프
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char)
}

/**
 * HTML 태그 제거
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

/**
 * 위험한 문자열 패턴 제거
 * - script 태그
 * - javascript: 프로토콜
 * - on* 이벤트 핸들러
 * - data: URI
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return ''

  return str
    // script 태그 제거
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // on* 이벤트 핸들러 제거
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // javascript: 프로토콜 제거
    .replace(/javascript:/gi, '')
    // data: URI 제거 (이미지 제외)
    .replace(/data:(?!image\/)/gi, '')
    // HTML 태그 제거
    .replace(/<[^>]*>/g, '')
    // 앞뒤 공백 제거
    .trim()
}

/**
 * 사용자 입력 텍스트 정리
 * - 과도한 공백 제거
 * - 연속된 줄바꿈 정리 (최대 2개)
 * - 위험한 문자열 제거
 */
export function sanitizeUserInput(str: string): string {
  if (!str || typeof str !== 'string') return ''

  return sanitizeString(str)
    // 연속된 공백을 하나로
    .replace(/[ \t]+/g, ' ')
    // 연속된 줄바꿈을 최대 2개로
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 객체의 모든 문자열 값을 sanitize
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj } as T

  for (const key of Object.keys(result)) {
    const value = result[key as keyof T]
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeUserInput(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>)
    }
  }

  return result
}
