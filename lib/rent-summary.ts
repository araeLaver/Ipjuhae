/**
 * 전세 실거래를 한 줄로 요약한다.
 *
 * 평균을 쓰지 않는다. 거래가 대여섯 건뿐인 단지에서 특이한 한 건이 끼면
 * 평균이 통째로 끌려간다. 중앙값과 범위를 보여주고 몇 건인지 밝힌다.
 * 3건짜리 통계를 5건짜리처럼 보여주면 그 숫자를 믿고 계약한다.
 */

export interface RentLike {
  depositManwon: number
  areaM2: number
  dealtAt: string
  name: string
}

export interface RentSummary {
  count: number
  /** 만원 */
  medianManwon: number
  minManwon: number
  maxManwon: number
  /** 가장 최근 거래일 YYYY-MM-DD */
  latestAt: string
}

export function summarizeRents(records: RentLike[]): RentSummary | null {
  if (records.length === 0) return null

  const deposits = records.map((r) => r.depositManwon).sort((a, b) => a - b)
  const mid = Math.floor(deposits.length / 2)
  const medianManwon =
    deposits.length % 2 === 0 ? Math.round((deposits[mid - 1] + deposits[mid]) / 2) : deposits[mid]

  return {
    count: deposits.length,
    medianManwon,
    minManwon: deposits[0],
    maxManwon: deposits[deposits.length - 1],
    latestAt: records.reduce((a, r) => (r.dealtAt > a ? r.dealtAt : a), ''),
  }
}

export type DepositVerdict = 'below' | 'typical' | 'above' | 'far_above'

export interface DepositComparison {
  verdict: DepositVerdict
  /** 중앙값 대비 비율. 1.15 = 15퍼센트 높음 */
  ratio: number
  headline: string
  detail: string
}

/**
 * 내 보증금이 이 단지의 전세 시세에서 어디쯤인지.
 *
 * 높다고 위험한 게 아니고 낮다고 안전한 것도 아니다. 그건 근저당과 시세가
 * 정한다. 여기서 말하는 건 **협상 여지**와 **왜 이렇게 비싼지 물어볼 근거**다.
 * 그 구분을 문장에서 분명히 한다.
 */
export function compareDeposit(
  myDepositManwon: number,
  summary: RentSummary
): DepositComparison | null {
  if (!myDepositManwon || summary.medianManwon <= 0) return null

  const ratio = myDepositManwon / summary.medianManwon
  const pct = Math.round(Math.abs(ratio - 1) * 100)

  // 거래가 적으면 판정을 세게 하지 않는다. 3건으로 "비쌉니다"라고 말할 수 없다.
  const thin = summary.count < 5

  if (ratio >= 1.25) {
    return {
      verdict: 'far_above',
      ratio,
      headline: `같은 단지 최근 전세보다 ${pct}퍼센트 높습니다`,
      detail: thin
        ? `다만 비교한 거래가 ${summary.count}건뿐입니다. 왜 이 금액인지 중개사에게 물어보시고, 면적과 층이 비슷한 거래인지도 확인하세요.`
        : '왜 이 금액인지 물어볼 근거가 됩니다. 시세보다 높은 보증금은 돌려받기도 그만큼 어려워집니다.',
    }
  }

  if (ratio >= 1.1) {
    return {
      verdict: 'above',
      ratio,
      headline: `같은 단지 최근 전세보다 ${pct}퍼센트 높습니다`,
      detail: thin
        ? `비교한 거래가 ${summary.count}건뿐이라 단정하기는 이릅니다. 층과 향, 수리 여부로 갈릴 수 있습니다.`
        : '층과 향, 수리 여부로 갈릴 수 있는 폭입니다. 그래도 한 번은 물어보실 만합니다.',
    }
  }

  if (ratio <= 0.85) {
    return {
      verdict: 'below',
      ratio,
      headline: `같은 단지 최근 전세보다 ${pct}퍼센트 낮습니다`,
      detail:
        '싸다고 안전한 것은 아닙니다. 근저당이 많거나 다른 사정이 있어 값이 내려간 경우도 있으니 등기부를 꼭 확인하세요.',
    }
  }

  return {
    verdict: 'typical',
    ratio,
    headline: '같은 단지 최근 전세와 비슷한 수준입니다',
    detail:
      '금액 자체는 평범합니다. 다만 보증금을 돌려받을 수 있는지는 근저당과 시세가 정합니다. 위 계산을 함께 보세요.',
  }
}
