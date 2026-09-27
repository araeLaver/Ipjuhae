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
 * 무엇을 임대차 기사로 볼 것인가.
 *
 * 낱말 하나로 판정했더니 "25조 늘어난 내년 청년 예산"과 부총리의 경제 브리핑이
 * 들어왔다. 둘 다 제목에는 임대차가 없고 부제에 '공공임대'가 한 번 스쳤을 뿐이다.
 *
 * 그래서 낱말을 두 갈래로 나눈다.
 *
 * STRONG  이 낱말이 나오면 주제가 임대차다. 제목이든 부제든 걸리면 통과
 * WEAK    넓은 주거 정책 용어다. 예산·복지 기사에도 흔히 섞인다.
 *         **제목에 있을 때만** 통과시킨다. 제목은 기사의 주제를 적는 자리다
 */
const STRONG_KEYWORDS = [
  '전세',
  '월세',
  '전월세',
  '임대차',
  '보증금',
  '전세사기',
  '임차인',
  '임대인',
  '역전세',
  '확정일자',
  '전입신고',
  '보증보험',
  '깡통',
]

const WEAK_KEYWORDS = ['공공임대', '임대주택', '주택임대', '주거안정', '주거지원', '주거비', '세입자']

/**
 * 같은 낱말이라도 우리 얘기가 아닌 것들.
 *
 * 농지 임대차가 대표적이다. '임대차'가 들어 있지만 집 이야기가 아니다.
 * 재난 지원도 뺀다 — 이재민 월세 지원은 임대차 정책이 아니라 재해 복구다.
 * 계약을 앞둔 사람이 찾는 화면에서는 소음이다.
 */
const EXCLUDE = [
  '농지',
  '농업',
  '농식품',
  '축산',
  '어촌',
  '산업단지',
  '상가건물',
  '이재민',
  '호우',
  '수해',
  '산불',
]

/**
 * 이 기사가 임대차 기사인가.
 *
 * 제목과 부제를 따로 받는다. 어디에 나왔는지가 판정을 가르기 때문이다.
 */
export function isRentalPolicy(title: string, subtitle: string): boolean {
  const whole = `${title} ${subtitle}`
  if (EXCLUDE.some((k) => whole.includes(k))) return false
  if (STRONG_KEYWORDS.some((k) => whole.includes(k))) return true
  return WEAK_KEYWORDS.some((k) => title.includes(k))
}

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

    // 본문은 보지 않는다. 본문까지 훑었더니 "2027년 예산" 기사가 걸렸다.
    // 본문 어딘가에 '월세'가 한 번 나왔을 뿐 임대차 기사가 아니다.
    if (!isRentalPolicy(title, subtitle)) continue

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
