export interface SyntheticDemoListing {
  id: string
  area: string
  propertyType: string
  monthlyRent: number
  deposit: number
  areaSqm: number
  rooms: number
  availableFrom: string
  transit: string
  highlights: string[]
  color: string
}

/**
 * 외부 공개 화면 캡처 전용 가상 데이터입니다.
 * 운영 API, DB, provider 응답에서 생성하거나 동기화하지 않습니다.
 */
export const syntheticDemoListings: readonly SyntheticDemoListing[] = [
  {
    id: 'demo-seongsu',
    area: '서울 성동구 성수동',
    propertyType: '아파트',
    monthlyRent: 95,
    deposit: 800,
    areaSqm: 48.2,
    rooms: 2,
    availableFrom: '2026년 9월',
    transit: '지하철 이용이 편리한 생활권',
    highlights: ['채광', '엘리베이터', '생활 편의시설'],
    color: 'from-orange-100 via-amber-50 to-emerald-100',
  },
  {
    id: 'demo-hapjeong',
    area: '서울 마포구 합정동',
    propertyType: '빌라',
    monthlyRent: 72,
    deposit: 500,
    areaSqm: 36.4,
    rooms: 1,
    availableFrom: '2026년 10월',
    transit: '버스와 지하철을 함께 이용하기 좋은 생활권',
    highlights: ['분리형 공간', '수납', '대중교통'],
    color: 'from-rose-100 via-stone-50 to-sky-100',
  },
  {
    id: 'demo-jeongja',
    area: '경기 성남시 분당구 정자동',
    propertyType: '오피스텔',
    monthlyRent: 68,
    deposit: 400,
    areaSqm: 29.8,
    rooms: 1,
    availableFrom: '2026년 11월',
    transit: '업무지구 이동을 살펴보기 좋은 생활권',
    highlights: ['보안 설비', '업무지구', '근린공원'],
    color: 'from-emerald-100 via-stone-50 to-amber-100',
  },
] as const

export function isSyntheticDemoEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_SYNTHETIC_DEMO !== 'false'
}
