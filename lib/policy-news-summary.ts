import type { PolicyNewsItem } from './policy-news'

export interface PolicyNewsHealth {
  status: string
  lastSuccessAt?: string | null
  lastAttemptAt?: string | null
  failedWindows?: number
  lastError?: string | null
  count?: number
}

export interface PolicyNewsSnapshot {
  items: PolicyNewsItem[]
  health: PolicyNewsHealth
}

export function koreanDay(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(
    date,
  )
}

export function summarizePolicyNews(
  items: PolicyNewsItem[],
  health: PolicyNewsHealth,
  now = new Date(),
) {
  const today = koreanDay(now)
  const checkedToday = Boolean(
    health.lastSuccessAt && koreanDay(new Date(health.lastSuccessAt)) === today,
  )
  const todayCount = items.filter((item) => item.approvedAt === today).length
  return {
    todayCount,
    latestPublishedAt: items.reduce(
      (latest, item) => (item.approvedAt > latest ? item.approvedAt : latest),
      '',
    ),
    message:
      health.status !== 'ok'
        ? '새 소식 확인이 지연되고 있습니다. 마지막으로 저장한 소식을 보여드립니다.'
        : todayCount > 0
          ? `오늘 발표된 소식 ${todayCount}건을 확인했습니다.`
          : checkedToday
            ? '오늘 확인한 범위에서는 새 발표가 없습니다.'
            : '오늘 수집 결과를 아직 확인하지 못했습니다.',
  }
}
