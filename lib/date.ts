/**
 * 날짜 유틸리티 함수
 */

/**
 * 날짜를 상대적 시간으로 변환 (예: "5분 전", "2시간 전", "3일 전")
 */
export function formatDistanceToNow(date: string | Date): string {
  const now = new Date()
  const target = new Date(date)
  const diffMs = now.getTime() - target.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffSec < 60) {
    return '방금 전'
  }
  if (diffMin < 60) {
    return `${diffMin}분 전`
  }
  if (diffHour < 24) {
    return `${diffHour}시간 전`
  }
  if (diffDay < 7) {
    return `${diffDay}일 전`
  }
  if (diffWeek < 4) {
    return `${diffWeek}주 전`
  }
  if (diffMonth < 12) {
    return `${diffMonth}개월 전`
  }
  return `${diffYear}년 전`
}

/**
 * 날짜를 한국어 형식으로 포맷 (예: "2024년 1월 15일")
 */
export function formatDate(date: string | Date): string {
  const target = new Date(date)
  return target.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * 날짜를 시간 포함 한국어 형식으로 포맷 (예: "2024년 1월 15일 오후 3:30")
 */
export function formatDateTime(date: string | Date): string {
  const target = new Date(date)
  return target.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * 시간만 포맷 (예: "오후 3:30")
 */
export function formatTime(date: string | Date): string {
  const target = new Date(date)
  return target.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * 오늘인지 확인
 */
export function isToday(date: string | Date): boolean {
  const target = new Date(date)
  const today = new Date()
  return (
    target.getDate() === today.getDate() &&
    target.getMonth() === today.getMonth() &&
    target.getFullYear() === today.getFullYear()
  )
}

/**
 * 메시지 날짜 표시 형식 (오늘이면 시간만, 아니면 날짜)
 */
export function formatMessageDate(date: string | Date): string {
  if (isToday(date)) {
    return formatTime(date)
  }
  return formatDate(date)
}
