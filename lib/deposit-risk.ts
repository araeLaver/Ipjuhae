/**
 * 보증금이 얼마나 위험한지 계산한다.
 *
 * 들어오는 숫자는 전부 **사용자가 등기부와 시세에서 직접 읽어온 것**이다.
 * 우리가 시세를 추정하거나 채워 넣지 않는다. 추정한 숫자로 "안전합니다"라고
 * 말하는 순간 이 화면은 위험해진다.
 *
 * 이 파일은 mobile/src/lib/depositRisk.ts 와 쌍이다.
 * 한쪽만 고치면 scripts/check-shared-logic.mjs 가 CI에서 막는다.
 */

export interface DepositRiskInput {
  /** 매매 시세 (만원). 사용자가 확인한 값. */
  marketPriceManwon: number
  /** 내 보증금 (만원) */
  depositManwon: number
  /** 등기부 을구의 근저당 채권최고액 합계 (만원). 없으면 0 */
  mortgageMaxManwon: number
  /** 나보다 먼저 들어온 세입자들의 보증금 합계 (만원). 다가구가 아니면 0 */
  priorDepositsManwon: number
}

export type RiskLevel = 'safe' | 'caution' | 'danger' | 'critical'

export interface DepositRiskResult {
  /** 나보다 앞선 돈의 합계 (만원) */
  seniorTotalManwon: number
  /** (앞선 돈 + 내 보증금) / 시세. 0.82 = 82% */
  burdenRatio: number
  /** 집이 시세대로 팔렸을 때 내 보증금에서 남는 돈 (만원). 음수면 떼인다 */
  cushionManwon: number
  /** 경매는 보통 시세보다 싸게 팔린다. 낙찰가율 70%를 가정한 최악의 경우 */
  auctionCushionManwon: number
  level: RiskLevel
  headline: string
  detail: string
  /** 지금 해야 할 일. 순서대로 */
  actions: string[]
  /** 이 결과와 이어지는 운영자 글 제목 */
  relatedGuides: string[]
}

/** 경매 낙찰가율 가정. 실제로는 물건마다 다르지만 보수적으로 잡는다. */
export const AUCTION_RECOVERY_RATE = 0.7

/** 보증보험 심사에서 통상 걸리는 선. 확정 기준은 HUG에 확인해야 한다. */
export const INSURANCE_THRESHOLD = 0.9

export function calculateDepositRisk(input: DepositRiskInput): DepositRiskResult {
  const { marketPriceManwon, depositManwon, mortgageMaxManwon, priorDepositsManwon } = input

  const seniorTotalManwon = mortgageMaxManwon + priorDepositsManwon
  const totalBurden = seniorTotalManwon + depositManwon

  const burdenRatio = marketPriceManwon > 0 ? totalBurden / marketPriceManwon : Infinity
  const cushionManwon = marketPriceManwon - totalBurden
  const auctionCushionManwon = Math.floor(marketPriceManwon * AUCTION_RECOVERY_RATE) - totalBurden

  const level = gradeOf(burdenRatio)
  const pct = Math.round(burdenRatio * 100)

  return {
    seniorTotalManwon,
    burdenRatio,
    cushionManwon,
    auctionCushionManwon,
    level,
    headline: headlineFor(level, pct),
    detail: detailFor(level, {
      pct,
      seniorTotalManwon,
      depositManwon,
      cushionManwon,
      auctionCushionManwon,
    }),
    actions: actionsFor(level, auctionCushionManwon),
    relatedGuides: guidesFor(level, mortgageMaxManwon, priorDepositsManwon),
  }
}

function gradeOf(ratio: number): RiskLevel {
  if (ratio > INSURANCE_THRESHOLD) return 'critical'
  if (ratio > 0.8) return 'danger'
  if (ratio > 0.6) return 'caution'
  return 'safe'
}

function headlineFor(level: RiskLevel, pct: number): string {
  switch (level) {
    case 'safe':
      return `시세의 ${pct}퍼센트입니다. 여유가 있는 편입니다`
    case 'caution':
      return `시세의 ${pct}퍼센트입니다. 조건을 더 봐야 합니다`
    case 'danger':
      return `시세의 ${pct}퍼센트입니다. 이 조건은 권하지 않습니다`
    case 'critical':
      return `시세의 ${pct}퍼센트입니다. 보증금을 돌려받기 어려운 구조입니다`
  }
}

function detailFor(
  level: RiskLevel,
  v: {
    pct: number
    seniorTotalManwon: number
    depositManwon: number
    cushionManwon: number
    auctionCushionManwon: number
  }
): string {
  const senior = manwon(v.seniorTotalManwon)
  const mine = manwon(v.depositManwon)

  const base =
    v.seniorTotalManwon > 0
      ? `내 보증금 ${mine}보다 먼저 가져가는 돈이 ${senior} 있습니다. `
      : `내 앞에 가져가는 돈은 없습니다. `

  if (v.auctionCushionManwon < 0) {
    return (
      base +
      `집이 경매로 넘어가 시세의 70퍼센트에 팔리면 ${manwon(Math.abs(v.auctionCushionManwon))}이 모자랍니다. ` +
      `그만큼은 돌려받지 못합니다.`
    )
  }

  if (v.cushionManwon < 0) {
    return base + `시세대로 팔려도 ${manwon(Math.abs(v.cushionManwon))}이 모자랍니다.`
  }

  if (level === 'safe') {
    return base + `시세대로 팔리면 ${manwon(v.cushionManwon)}이 남습니다. 경매로 넘어가도 보증금은 남는 계산입니다.`
  }

  return (
    base +
    `시세대로 팔리면 ${manwon(v.cushionManwon)}이 남지만, 경매는 시세보다 싸게 팔립니다. ` +
    `70퍼센트에 팔린다고 보면 여유는 ${manwon(v.auctionCushionManwon)}까지 줄어듭니다.`
  )
}

function actionsFor(level: RiskLevel, auctionCushion: number): string[] {
  const always = [
    '계약 당일 전입신고와 확정일자를 함께 받으세요. 효력은 다음 날 0시부터입니다',
    '계약 직전에 등기부를 다시 떼어 보세요. 며칠 사이에 근저당이 잡히기도 합니다',
  ]

  switch (level) {
    case 'safe':
      return always
    case 'caution':
      return [
        '보증보험에 가입되는 집인지 먼저 확인하세요',
        '잔금 전까지 근저당을 말소한다는 조건을 계약서에 넣으세요',
        ...always,
      ]
    case 'danger':
      return [
        '근저당 말소를 조건으로 걸 수 없다면 이 집은 넘기는 편이 낫습니다',
        '보증보험 가입이 거절될 가능성이 큽니다. 계약 전에 확인하세요',
        '집주인이 보증금으로 근저당을 갚겠다고 하면, 잔금과 말소를 같은 날 처리하는 조건을 문서로 남기세요',
        ...always,
      ]
    case 'critical':
      return [
        auctionCushion < 0
          ? '지금 조건으로는 보증금 일부를 못 받을 가능성이 높습니다. 계약을 멈추세요'
          : '지금 조건으로는 권하지 않습니다. 계약을 멈추세요',
        '그래도 진행한다면 잔금 전에 선순위 채권이 전부 말소되는지부터 확인하세요',
        '보증보험 가입 가능 여부를 HUG에 직접 문의하세요',
      ]
  }
}

function guidesFor(level: RiskLevel, mortgage: number, priorDeposits: number): string[] {
  const guides: string[] = []
  if (mortgage > 0) guides.push('등기부 뜯어보기 3화. 근저당과 순위')
  if (priorDeposits > 0) guides.push('등기부 뜯어보기 9화. 다가구와 다세대가 다른 이유')
  if (level === 'danger' || level === 'critical') {
    guides.push('등기부 뜯어보기 11화. 보증보험이 거절되는 집')
  }
  guides.push('등기부 뜯어보기 10화. 전입신고와 확정일자, 하루가 갈랐다')
  return guides
}

/** 12345 -> "1억 2,345만원" */
export function manwon(value: number): string {
  const v = Math.abs(Math.round(value))
  if (v === 0) return '0원'
  const eok = Math.floor(v / 10000)
  const rest = v % 10000
  if (eok > 0 && rest > 0) return `${eok}억 ${rest.toLocaleString('ko-KR')}만원`
  if (eok > 0) return `${eok}억원`
  return `${rest.toLocaleString('ko-KR')}만원`
}

/**
 * 화면에 쓸 때는 이걸 쓴다. manwon()은 절대값이라 부호가 사라진다.
 * "1억 2,000만원"과 "1억 2,000만원 부족"은 정반대의 뜻이다.
 */
export function cushionLabel(value: number): string {
  if (value < 0) return `${manwon(value)} 부족`
  if (value === 0) return '딱 맞음'
  return `${manwon(value)} 남음`
}
