import { logger } from '@/lib/logger'

/**
 * 대한민국 정책브리핑 정책뉴스.
 *
 * 공공데이터포털 「문화체육관광부_정책브리핑_정책뉴스_API」.
 * https://www.data.go.kr/data/15095335/openapi.do
 *
 * 실제로 호출해 확인한 것들 (2026-09-22)
 *
 * - 오퍼레이션은 `policyNewsList2`. `getPolicyNewsList` 류는 전부 없는 서비스다
 * - `startDate`/`endDate`는 필수고 **최대 3일**까지만 된다. 넘기면 THREE_DAYS_OVER_ERROR
 * - 응답은 XML이고 항목은 `<NewsItem>`. 본문 필드는 전부 CDATA로 감싸여 있다
 * - 날짜는 `MM/DD/YYYY HH:mm:ss` 형식이다. 한국 API인데 미국식이라 헷갈린다
 * - 3일치가 35건쯤 된다. 그중 임대차 관련은 몇 건 없어서 기간을 넉넉히 훑어야 한다
 *
 * 지키는 것
 *
 * 1. 키가 없으면 아무것도 내보내지 않는다. 빈 칸을 두지 않는다
 * 2. 출처를 표시한다. 공공누리 제1유형이라 이용 조건이다
 * 3. 캐시한다. 개발계정은 하루 1,000회다
 */

const ENDPOINT = 'https://apis.data.go.kr/1371000/policyNewsService2/policyNewsList2'

/** 한 번에 조회 가능한 최대 기간. API 제약이다. */
const MAX_DAYS_PER_CALL = 3

/**
 * 며칠치를 훑을지. 3일 단위로 나눠 호출하므로 호출 수 = ceil(이 값 / 3).
 *
 * 21일로 했더니 임대차 기사가 2건뿐이었다. 정책 발표는 매일 나오는 게 아니다.
 * 45일이면 15회 호출인데, 30분 캐시가 있어 하루 1,000회 제한에 한참 못 미친다.
 */
const LOOKBACK_DAYS = 45

/** 30분. 하루 1,000회 제한 안에서 넉넉하다. */
const CACHE_SECONDS = 1800

/**
 * 임대차와 무관한 정책까지 보여주면 소음이다.
 *
 * '주거'처럼 넓은 말은 뺐다. 한부모가족 지원이나 재난 이재민 지원까지 딸려 온다.
 * 나쁜 기사가 아니라 이 화면에서 찾는 것이 아니다.
 */
const KEYWORDS = [
  '전세',
  '월세',
  '임대차',
  '보증금',
  '전세사기',
  '임차인',
  '임대인',
  '주택임대',
  '임대주택',
  '보증보험',
  '깡통',
  '확정일자',
  '전입신고',
  '역전세',
  '전월세',
  '공공임대',
  '주거안정',
  '주거지원',
  '주거비',
  '세입자',
]

/**
 * 같은 낱말이라도 우리 얘기가 아닌 것들.
 *
 * 농지 임대차가 대표적이다. '임대차'가 들어 있지만 집 이야기가 아니다.
 */
const EXCLUDE = ['농지', '농업', '농식품', '축산', '어촌', '산업단지', '상가건물']

export interface PolicyNewsItem {
  id: string
  title: string
  summary: string
  url: string
  /** YYYY-MM-DD */
  approvedAt: string
  /** 발표 부처. 없으면 빈 문자열. */
  ministry: string
}

export function isPolicyNewsEnabled(): boolean {
  return Boolean(process.env.PUBLIC_DATA_API_KEY)
}

/**
 * 포털이 주는 인증키는 이미 URL 인코딩돼 있다(%2B, %2F, %3D).
 * URLSearchParams에 넣으면 퍼센트가 한 번 더 인코딩돼 인증이 깨진다.
 * 그래서 쿼리 문자열을 직접 이어 붙인다.
 */
function buildUrl(key: string, startDate: string, endDate: string): string {
  const params = `numOfRows=100&pageNo=1&startDate=${startDate}&endDate=${endDate}`
  return `${ENDPOINT}?serviceKey=${key}&${params}`
}

function cdata(raw: string): string {
  const m = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return (m ? m[1] : raw).trim()
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? cdata(m[1]) : ''
}

/** "09/22/2026 17:42:00" -> "2026-09-22" */
function normalizeDate(raw: string): string {
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  return `${m[3]}-${m[1]}-${m[2]}`
}

/** YYYYMMDD */
function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 태그와 엔티티를 걷어낸다.
 *
 * 제목에도 `&middot;`가 그대로 들어오고 부제에는 `<br>`이 섞인다.
 * 본문뿐 아니라 제목·부제에도 똑같이 걸어야 화면이 깨지지 않는다.
 */
function clean(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksRelevant(text: string): boolean {
  if (EXCLUDE.some((k) => text.includes(k))) return false
  return KEYWORDS.some((k) => text.includes(k))
}

async function fetchWindow(key: string, start: Date, end: Date): Promise<PolicyNewsItem[]> {
  const res = await fetch(buildUrl(key, ymd(start), ymd(end)), {
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const xml = await res.text()
  const blocks = xml.match(/<NewsItem>[\s\S]*?<\/NewsItem>/g) ?? []

  const out: PolicyNewsItem[] = []
  for (const block of blocks) {
    const title = clean(tag(block, 'Title'))
    const url = tag(block, 'OriginalUrl')
    if (!title || !url.startsWith('https://')) continue

    const subtitle = clean(tag(block, 'SubTitle1'))
    const contents = clean(tag(block, 'DataContents'))

    // 제목과 부제로만 판단한다.
    //
    // 본문까지 훑었더니 "2027년 예산" 기사가 걸렸다. 본문 어딘가에 '월세'가
    // 한 번 나왔을 뿐 임대차 기사가 아니다. 기사의 주제는 제목에 있다.
    if (!looksRelevant(`${title} ${subtitle}`)) continue

    out.push({
      id: tag(block, 'NewsItemId') || url,
      title,
      summary: (subtitle || contents).slice(0, 110),
      url,
      approvedAt: normalizeDate(tag(block, 'ApproveDate')),
      ministry: tag(block, 'MinisterCode'),
    })
  }
  return out
}

/**
 * 임대차 관련 정책뉴스를 최신순으로 가져온다.
 *
 * 한 번에 3일까지만 조회되므로 구간을 나눠 부른다. 한 구간이 실패해도
 * 나머지는 살린다. 정책 소식이 안 떠도 사이트의 나머지는 멀쩡해야 한다.
 */
export async function fetchPolicyNews(limit = 5): Promise<PolicyNewsItem[]> {
  const key = process.env.PUBLIC_DATA_API_KEY
  if (!key) return []

  const windows: Array<[Date, Date]> = []
  const today = new Date()
  for (let offset = 0; offset < LOOKBACK_DAYS; offset += MAX_DAYS_PER_CALL) {
    const end = new Date(today)
    end.setDate(end.getDate() - offset)
    const start = new Date(end)
    start.setDate(start.getDate() - (MAX_DAYS_PER_CALL - 1))
    windows.push([start, end])
  }

  // 순차로 부른다.
  //
  // 15개 구간을 한꺼번에 던졌더니 5개가 실패했다. 포털이 동시 요청을 끊는다.
  // 어차피 30분 캐시라 첫 한 번만 느리면 된다. 목표 건수를 채우면 멈춘다.
  const seen = new Set<string>()
  const items: PolicyNewsItem[] = []
  let failed = 0

  for (const [start, end] of windows) {
    if (items.length >= limit) break
    try {
      for (const item of await fetchWindow(key, start, end)) {
        if (seen.has(item.id)) continue
        seen.add(item.id)
        items.push(item)
      }
    } catch {
      failed += 1
    }
  }

  items.sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
  return items.slice(0, limit)
}
