import { logger } from '@/lib/logger'

/**
 * 국토교통부 실거래가.
 *
 * `/check`의 가장 큰 마찰은 "매매 시세를 직접 찾아 넣어야 한다"는 것이다.
 * 그 숫자를 우리가 **추정해서** 채우면 안 되지만, 국토부에 **신고된 실제 거래가**를
 * 보여주는 건 추정이 아니다. 고르는 건 여전히 사용자다.
 *
 * 실제로 호출해 확인한 것 (2026-09-22)
 *
 * - 엔드포인트마다 오퍼레이션 이름이 경로와 같다.
 *   RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade 꼴이다
 * - 필수 파라미터는 LAWD_CD(법정동코드 앞 5자리)와 DEAL_YMD(계약년월 6자리)
 * - 응답은 XML, 항목은 <item>
 * - 금액은 "40,000" 처럼 쉼표가 박힌 만원 단위 문자열이다
 * - 아파트 전월세는 동·호 정보를 주지 않는다. 개인정보 보호 때문이다
 *
 * 법정동코드는 다음 우편번호 API가 주는 bcode 앞 5자리를 쓴다.
 * 별도 코드표를 들고 다닐 필요가 없다.
 */

const BASE = 'https://apis.data.go.kr/1613000'

export type BuildingKind = 'apt' | 'rowhouse' | 'officetel'

/** 매매는 아파트만 신청돼 있다. 나머지는 전월세만 조회된다. */
const TRADE_SERVICE: Partial<Record<BuildingKind, string>> = {
  apt: 'RTMSDataSvcAptTrade',
}

const RENT_SERVICE: Record<BuildingKind, string> = {
  apt: 'RTMSDataSvcAptRent',
  rowhouse: 'RTMSDataSvcRHRent',
  officetel: 'RTMSDataSvcOffiRent',
}

export const BUILDING_LABELS: Record<BuildingKind, string> = {
  apt: '아파트',
  rowhouse: '연립·다세대',
  officetel: '오피스텔',
}

/** 한 번 조회할 때 거슬러 올라가는 개월 수. 최근 거래가 없는 단지가 많다. */
const MONTHS_BACK = 6

const CACHE_SECONDS = 60 * 60 * 6

export interface TradeRecord {
  /** 단지 또는 건물 이름 */
  name: string
  /** 전용면적 제곱미터 */
  areaM2: number
  /** 만원 */
  priceManwon: number
  floor: number
  /** YYYY-MM-DD */
  dealtAt: string
  /** 법정동 이름 */
  dong: string
  buildYear: number
}

export interface RentRecord extends Omit<TradeRecord, 'priceManwon'> {
  depositManwon: number
  monthlyRentManwon: number
}

export function isRealEstateEnabled(): boolean {
  return Boolean(process.env.PUBLIC_DATA_API_KEY)
}

/**
 * 인증키는 이미 URL 인코딩돼 있다. URLSearchParams 에 넣으면 이중 인코딩된다.
 * 쿼리를 직접 이어 붙인다.
 */
function buildUrl(service: string, lawdCd: string, dealYmd: string): string {
  return (
    `${BASE}/${service}/get${service}` +
    `?serviceKey=${process.env.PUBLIC_DATA_API_KEY}` +
    `&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1`
  )
}

function field(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].trim() : ''
}

/** "40,000" -> 40000. 값이 없거나 숫자가 아니면 0. */
function manwonOf(raw: string): number {
  const n = Number(raw.replace(/[^0-9]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function dateOf(block: string): string {
  const y = field(block, 'dealYear')
  const m = field(block, 'dealMonth').padStart(2, '0')
  const d = field(block, 'dealDay').padStart(2, '0')
  return y ? `${y}-${m}-${d}` : ''
}

/** 이름 필드가 종류마다 다르다. */
function nameOf(block: string): string {
  return (
    field(block, 'aptNm') ||
    field(block, 'mhouseNm') ||
    field(block, 'offiNm') ||
    field(block, 'umdNm')
  )
}

/** 최근 N개월의 계약년월 목록. 최신순. */
function recentMonths(count: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

async function fetchBlocks(url: string): Promise<string[]> {
  const res = await fetch(url, {
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const xml = await res.text()

  // 인증 실패나 한도 초과는 200 으로 오고 본문에 코드가 들어온다.
  const code = field(xml, 'resultCode')
  if (code && code !== '000' && code !== '00' && code !== '0') {
    throw new Error(`API ${code}: ${field(xml, 'resultMsg') || field(xml, 'returnAuthMsg')}`)
  }
  return xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
}

/**
 * 매매 실거래가. `/check`의 "매매 시세" 칸을 채우는 데 쓴다.
 *
 * @param lawdCd 법정동코드 앞 5자리
 * @param keyword 단지 이름 일부. 비우면 그 지역 전부
 */
export async function fetchTrades(
  lawdCd: string,
  keyword = '',
  kind: BuildingKind = 'apt'
): Promise<TradeRecord[]> {
  const service = TRADE_SERVICE[kind]
  if (!process.env.PUBLIC_DATA_API_KEY || !service) return []
  if (!/^\d{5}$/.test(lawdCd)) return []

  const needle = keyword.replace(/\s/g, '')
  const out: TradeRecord[] = []

  // 순차로 부른다. 병렬로 던지면 포털이 끊는다.
  for (const ym of recentMonths(MONTHS_BACK)) {
    try {
      for (const block of await fetchBlocks(buildUrl(service, lawdCd, ym))) {
        const name = nameOf(block)
        if (needle && !name.replace(/\s/g, '').includes(needle)) continue

        const priceManwon = manwonOf(field(block, 'dealAmount'))
        if (priceManwon <= 0) continue

        out.push({
          name,
          areaM2: Number(field(block, 'excluUseAr')) || 0,
          priceManwon,
          floor: Number(field(block, 'floor')) || 0,
          dealtAt: dateOf(block),
          dong: field(block, 'umdNm'),
          buildYear: Number(field(block, 'buildYear')) || 0,
        })
      }
    } catch (error) {
      logger.warn('실거래가 조회 실패', { lawdCd, ym, error })
    }
  }

  out.sort((a, b) => b.dealtAt.localeCompare(a.dealtAt))
  return out
}

/** 전월세 실거래가. 같은 조건의 전세가 얼마에 나가는지 보여줄 때 쓴다. */
export async function fetchRents(
  lawdCd: string,
  keyword = '',
  kind: BuildingKind = 'apt'
): Promise<RentRecord[]> {
  if (!process.env.PUBLIC_DATA_API_KEY) return []
  if (!/^\d{5}$/.test(lawdCd)) return []

  const needle = keyword.replace(/\s/g, '')
  const out: RentRecord[] = []

  for (const ym of recentMonths(MONTHS_BACK)) {
    try {
      for (const block of await fetchBlocks(buildUrl(RENT_SERVICE[kind], lawdCd, ym))) {
        const name = nameOf(block)
        if (needle && !name.replace(/\s/g, '').includes(needle)) continue

        const depositManwon = manwonOf(field(block, 'deposit'))
        if (depositManwon <= 0) continue

        out.push({
          name,
          areaM2: Number(field(block, 'excluUseAr')) || 0,
          depositManwon,
          monthlyRentManwon: manwonOf(field(block, 'monthlyRent')),
          floor: Number(field(block, 'floor')) || 0,
          dealtAt: dateOf(block),
          dong: field(block, 'umdNm'),
          buildYear: Number(field(block, 'buildYear')) || 0,
        })
      }
    } catch (error) {
      logger.warn('전월세 실거래가 조회 실패', { lawdCd, ym, error })
    }
  }

  out.sort((a, b) => b.dealtAt.localeCompare(a.dealtAt))
  return out
}

/**
 * 같은 단지·비슷한 면적의 거래만 남긴다.
 *
 * 전용면적이 10제곱미터만 달라도 값이 크게 달라진다. 84제곱미터를 찾는데
 * 59제곱미터 거래가 섞여 들어오면 시세를 낮게 잡게 된다.
 */
export function narrowByArea<T extends { areaM2: number }>(
  records: T[],
  targetAreaM2: number,
  toleranceM2 = 5
): T[] {
  if (!targetAreaM2) return records
  return records.filter((r) => Math.abs(r.areaM2 - targetAreaM2) <= toleranceM2)
}
