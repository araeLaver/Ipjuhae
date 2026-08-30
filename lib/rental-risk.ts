export type MatchGrade = 'exact' | 'strong' | 'alias' | 'insufficient'

export interface ComplexRecord {
  complexId: string
  parcelAddress: string
  roadAddress: string
  complexName: string
  aliases?: string[]
  builtYear?: number
}

export interface RentalTransaction {
  parcelAddress: string
  roadAddress: string
  complexName: string
  areaM2: number
  contractDate: string
  depositManwon: number
  monthlyRentManwon: number
  floor: number
  cancelled?: boolean
}

export interface RiskBriefInput {
  address: string
  complexName: string
  areaM2: number
  depositManwon: number
  monthlyRentManwon: number
}

export interface RiskBrief {
  input: RiskBriefInput
  match: { complexId: string | null; grade: MatchGrade; method: string }
  comparison: {
    scope: 'complex_area' | 'complex_area_expanded' | 'district' | 'insufficient'
    periodMonths: 12 | 24
    sampleCount: number
    lastContractDate: string | null
  }
  metrics: {
    pricePosition: { depositPercentile: number | null; monthlyRentPercentile: number | null }
    depositMedianDifferenceRate: number | null
    shortTermDepositChangeRate: number | null
    sampleAdequacy: 'high' | 'medium' | 'low'
    matchingConfidence: MatchGrade
  }
  signals: string[]
  limitations: string[]
  sourceAsOf: string
}

const normalizeText = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\([^)]*\)/g, '')
  .replace(/아파트|apt/g, '')
  .replace(/[^0-9a-z가-힣]/g, '')

const normalizeAddress = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/\([^)]*\)/g, '')
  .replace(/\s+/g, '')

function monthsBefore(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() - months)
  return result
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function percentile(value: number, samples: number[]): number | null {
  if (!samples.length) return null
  return Math.round((samples.filter((sample) => sample <= value).length / samples.length) * 100)
}

function districtKey(address: string): string {
  return address.trim().split(/\s+/).slice(0, 2).join(' ')
}

export function matchComplex(input: RiskBriefInput, complexes: ComplexRecord[]) {
  const address = normalizeAddress(input.address)
  const name = normalizeText(input.complexName)

  const exact = complexes.filter((complex) =>
    normalizeAddress(complex.parcelAddress) === address && normalizeText(complex.complexName) === name,
  )
  if (exact.length === 1) return { complex: exact[0], grade: 'exact' as const, method: 'parcel_address+complex_name' }

  const strong = complexes.filter((complex) =>
    normalizeAddress(complex.roadAddress) === address && normalizeText(complex.complexName) === name,
  )
  if (strong.length === 1) return { complex: strong[0], grade: 'strong' as const, method: 'road_address+complex_name' }

  const alias = complexes.filter((complex) => {
    const addressMatches = [complex.parcelAddress, complex.roadAddress].some((candidate) => normalizeAddress(candidate) === address)
    return addressMatches && (complex.aliases ?? []).some((candidate) => normalizeText(candidate) === name)
  })
  if (alias.length === 1) return { complex: alias[0], grade: 'alias' as const, method: 'address+complex_name_alias' }

  return { complex: null, grade: 'insufficient' as const, method: 'no_unique_match' }
}

function deduplicate(transactions: RentalTransaction[]): RentalTransaction[] {
  const seen = new Set<string>()
  return transactions.filter((transaction) => {
    if (transaction.cancelled || transaction.areaM2 <= 0 || transaction.depositManwon < 0 || transaction.monthlyRentManwon < 0) return false
    const key = [transaction.contractDate, transaction.parcelAddress, transaction.complexName, transaction.areaM2,
      transaction.floor, transaction.depositManwon, transaction.monthlyRentManwon].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function createRentalRiskBrief(args: {
  input: RiskBriefInput
  complexes: ComplexRecord[]
  transactions: RentalTransaction[]
  sourceAsOf: string
}): RiskBrief {
  const { input, complexes, sourceAsOf } = args
  const asOf = new Date(`${sourceAsOf}T23:59:59Z`)
  const matched = matchComplex(input, complexes)
  const clean = deduplicate(args.transactions).filter((transaction) => new Date(transaction.contractDate) <= asOf)
  const targetNames = matched.complex
    ? [matched.complex.complexName, ...(matched.complex.aliases ?? [])].map(normalizeText)
    : [normalizeText(input.complexName)]
  const inComplex = clean.filter((transaction) => targetNames.includes(normalizeText(transaction.complexName)))
  const recent12 = inComplex.filter((transaction) =>
    Math.abs(transaction.areaM2 - input.areaM2) <= 0.1 && new Date(transaction.contractDate) >= monthsBefore(asOf, 12),
  )
  const recent24Expanded = inComplex.filter((transaction) =>
    Math.abs(transaction.areaM2 - input.areaM2) <= 1 && new Date(transaction.contractDate) >= monthsBefore(asOf, 24),
  )

  let samples = recent12
  let scope: RiskBrief['comparison']['scope'] = 'complex_area'
  let periodMonths: 12 | 24 = 12
  if (samples.length < 10) {
    samples = recent24Expanded
    scope = 'complex_area_expanded'
    periodMonths = 24
  }
  if (samples.length < 5) {
    const district = districtKey(input.address)
    samples = clean.filter((transaction) =>
      districtKey(transaction.parcelAddress) === district && Math.abs(transaction.areaM2 - input.areaM2) <= 1 &&
      new Date(transaction.contractDate) >= monthsBefore(asOf, 24),
    )
    scope = samples.length ? 'district' : 'insufficient'
    periodMonths = 24
  }

  const deposits = samples.map((sample) => sample.depositManwon)
  const rents = samples.map((sample) => sample.monthlyRentManwon)
  const depositMedian = median(deposits)
  const threeMonthsAgo = monthsBefore(asOf, 3)
  const sixMonthsAgo = monthsBefore(asOf, 6)
  const currentMedian = median(samples.filter((sample) => new Date(sample.contractDate) >= threeMonthsAgo).map((sample) => sample.depositManwon))
  const priorMedian = median(samples.filter((sample) => {
    const date = new Date(sample.contractDate)
    return date >= sixMonthsAgo && date < threeMonthsAgo
  }).map((sample) => sample.depositManwon))
  const currentCount = samples.filter((sample) => new Date(sample.contractDate) >= threeMonthsAgo).length
  const priorCount = samples.filter((sample) => {
    const date = new Date(sample.contractDate)
    return date >= sixMonthsAgo && date < threeMonthsAgo
  }).length
  const lastContractDate = samples.map((sample) => sample.contractDate).sort().at(-1) ?? null
  const stale = lastContractDate ? (asOf.getTime() - new Date(lastContractDate).getTime()) / 86_400_000 > 180 : true
  const adequacy = samples.length < 5 || stale ? 'low' : samples.length < 10 ? 'medium' : 'high'
  const difference = depositMedian && depositMedian > 0 ? (input.depositManwon - depositMedian) / depositMedian : null
  const trend = currentCount >= 3 && priorCount >= 3 && currentMedian !== null && priorMedian && priorMedian > 0
    ? (currentMedian - priorMedian) / priorMedian
    : null
  const signals: string[] = []
  if (difference !== null && Math.abs(difference) >= 0.2) signals.push('최근 중앙값과 20% 이상 차이: 추가 확인 필요')
  if (adequacy === 'low') signals.push('비교 표본이 부족하거나 최근 거래가 오래됨')
  if (matched.grade === 'insufficient') signals.push('주소·단지 자동 매칭 불충분: 단지 선택 확인 필요')

  return {
    input,
    match: { complexId: matched.complex?.complexId ?? null, grade: matched.grade, method: matched.method },
    comparison: { scope, periodMonths, sampleCount: samples.length, lastContractDate },
    metrics: {
      pricePosition: {
        depositPercentile: percentile(input.depositManwon, deposits),
        monthlyRentPercentile: percentile(input.monthlyRentManwon, rents),
      },
      depositMedianDifferenceRate: difference,
      shortTermDepositChangeRate: trend,
      sampleAdequacy: adequacy,
      matchingConfidence: matched.grade,
    },
    signals,
    limitations: [
      '가격 이상도 참고정보이며 사기·권리관계·보증금 회수 가능성을 판정하지 않습니다.',
      '공개 거래자료에는 동·호와 임대인 정보가 포함되지 않습니다.',
      ...(samples.length < 5 ? ['비교 표본 5건 미만에서는 수치 판정을 확정적으로 해석할 수 없습니다.'] : []),
    ],
    sourceAsOf,
  }
}

export function evaluateMatchingQuality(results: Array<{ expectedComplexId: string | null; matchedComplexId: string | null }>) {
  const predicted = results.filter((result) => result.matchedComplexId !== null)
  const correct = predicted.filter((result) => result.matchedComplexId === result.expectedComplexId).length
  const eligible = results.filter((result) => result.expectedComplexId !== null).length
  const precision = predicted.length ? correct / predicted.length : 0
  const coverage = eligible ? correct / eligible : 0
  return { precision, coverage, go: precision >= 0.95 && coverage >= 0.8 }
}
