import { logger } from '@/lib/logger'

/**
 * 대한민국 정책브리핑 정책뉴스.
 *
 * 공공데이터포털 「문화체육관광부_정책브리핑_정책뉴스_API」를 쓴다.
 * https://www.data.go.kr/data/15095335/openapi.do
 *
 * 세 가지를 지킨다.
 *
 * 1. **키가 없으면 아무것도 내보내지 않는다.** 빈 칸이나 "곧 제공됩니다"를 두지 않는다.
 *    없는 걸 있는 척하지 않는다.
 * 2. **출처를 반드시 표시한다.** 공공저작물 제1유형이라 출처표시가 의무다.
 *    예의가 아니라 이용 조건이다.
 * 3. **캐시한다.** 개발계정은 하루 1,000회다. 방문자마다 호출하면 금방 막힌다.
 *
 * 응답 필드 이름은 포털 문서에 공개돼 있지 않아 실제 호출로 확인해야 한다.
 * 그래서 파싱을 느슨하게 두고, 모양이 다르면 빈 목록을 돌려준다.
 */

const ENDPOINT = 'https://apis.data.go.kr/1371000/policyNewsService/policyNewsList'

/** 하루 1,000회 제한. 30분 캐시면 한 화면당 48회면 충분하다. */
const CACHE_SECONDS = 1800

/** 임대차와 상관없는 정책까지 다 보여주면 소음이다. */
const KEYWORDS = [
  '전세',
  '월세',
  '임대차',
  '보증금',
  '전세사기',
  '임차인',
  '임대인',
  '주택임대',
  '주거',
  '보증보험',
  '청년 주거',
]

export interface PolicyNewsItem {
  title: string
  summary: string
  url: string
  /** YYYY-MM-DD. 없으면 빈 문자열. */
  approvedAt: string
}

export function isPolicyNewsEnabled(): boolean {
  return Boolean(process.env.PUBLIC_DATA_API_KEY)
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** "20260922" 또는 "2026-09-22 10:00" -> "2026-09-22" */
function normalizeDate(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function looksRelevant(text: string): boolean {
  return KEYWORDS.some((k) => text.includes(k))
}

/**
 * 임대차 관련 정책뉴스를 가져온다.
 *
 * 실패하면 빈 배열이다. 정책뉴스가 안 떠도 사이트의 나머지는 멀쩡해야 한다.
 */
export async function fetchPolicyNews(limit = 5): Promise<PolicyNewsItem[]> {
  const key = process.env.PUBLIC_DATA_API_KEY
  if (!key) return []

  const url = new URL(ENDPOINT)
  url.searchParams.set('serviceKey', key)
  url.searchParams.set('numOfRows', '60')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('returnType', 'json')

  try {
    const res = await fetch(url, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) {
      logger.warn('정책뉴스 응답 오류', { status: res.status })
      return []
    }

    const json: unknown = await res.json()
    const rows = extractRows(json)
    if (rows.length === 0) {
      logger.warn('정책뉴스 응답에서 목록을 찾지 못함')
      return []
    }

    const items: PolicyNewsItem[] = []
    for (const row of rows) {
      const title = pick(row, ['newsItemTitle', 'title', 'NewsItemTitle', 'subTitle'])
      if (!title) continue

      const summary = pick(row, ['subTitle1', 'subTitle', 'dataContents', 'contents'])
      const link = pick(row, ['originalUrl', 'linkUrl', 'url'])
      if (!link.startsWith('https://')) continue

      if (!looksRelevant(`${title} ${summary}`)) continue

      items.push({
        title,
        summary: summary.slice(0, 120),
        url: link,
        approvedAt: normalizeDate(pick(row, ['approveDate', 'approvalDate', 'regDate'])),
      })
      if (items.length >= limit) break
    }
    return items
  } catch (error) {
    logger.warn('정책뉴스 조회 실패', { error })
    return []
  }
}

/** 응답 껍데기가 기관마다 달라서 흔한 모양을 차례로 찾아본다. */
function extractRows(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== 'object') return []

  const candidates: unknown[] = []
  const root = json as Record<string, unknown>

  const body = (root.response as Record<string, unknown> | undefined)?.body ?? root.body
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    candidates.push(b.items, (b.items as Record<string, unknown> | undefined)?.item)
  }
  candidates.push(root.NewsItem, root.items, root.item, root.newsList)

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0 && typeof c[0] === 'object') {
      return c as Array<Record<string, unknown>>
    }
  }
  return []
}
