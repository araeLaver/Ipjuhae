export interface PublicMockListing {
  id: string
  title: string
  address: string
  region: string
  propertyType: string
  deposit: number
  monthlyRent: number
  areaSqm: number
  floorLabel: string
  availableFrom: string
  nearestStation: string
  status: '확인됨' | '미확인' | '추가 확인 필요'
  checkedAt: string
  notes: string[]
}

export const publicMockListings: PublicMockListing[] = [
  {
    id: 'demo-seongnam-01',
    title: '분당구 정자동 역세권 오피스텔',
    address: '경기도 성남시 분당구 정자동',
    region: '성남시 분당구',
    propertyType: '오피스텔',
    deposit: 1000,
    monthlyRent: 82,
    areaSqm: 29,
    floorLabel: '중층',
    availableFrom: '2026-09 협의',
    nearestStation: '정자역 권역',
    status: '확인됨',
    checkedAt: '2026-08-03 기준',
    notes: ['주소는 법정동 수준으로 축약', '관리비와 입주 가능일은 추가 확인 필요'],
  },
  {
    id: 'demo-suwon-01',
    title: '영통구 광교 생활권 아파트',
    address: '경기도 수원시 영통구 이의동',
    region: '수원시 영통구',
    propertyType: '아파트',
    deposit: 3000,
    monthlyRent: 115,
    areaSqm: 52,
    floorLabel: '고층',
    availableFrom: '2026-10 초',
    nearestStation: '광교중앙역 권역',
    status: '추가 확인 필요',
    checkedAt: '2026-08-03 기준',
    notes: ['등기·권리관계 원문은 demo에 포함하지 않음', '실거래·계약 안전성 확약 표현 제외'],
  },
  {
    id: 'demo-goyang-01',
    title: '일산동구 백석동 소형 빌라',
    address: '경기도 고양시 일산동구 백석동',
    region: '고양시 일산동구',
    propertyType: '빌라',
    deposit: 1500,
    monthlyRent: 64,
    areaSqm: 35,
    floorLabel: '저층',
    availableFrom: '즉시 협의',
    nearestStation: '백석역 권역',
    status: '미확인',
    checkedAt: '2026-08-03 기준',
    notes: ['fixture 전용 가상 데이터', '연락처·소유자·호수 정보 없음'],
  },
]

export function formatKrwManwon(amount: number): string {
  if (amount >= 10000) return `${Math.floor(amount / 10000)}억 ${amount % 10000}만원`
  return `${amount}만원`
}
