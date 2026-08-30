import type { ComplexRecord, RentalTransaction } from '@/lib/rental-risk'

export const SAMPLE_SOURCE_AS_OF = '2026-08-01'

export const SAMPLE_COMPLEXES: ComplexRecord[] = [
  {
    complexId: '11680-0001',
    parcelAddress: '서울 강남구 대치동 316',
    roadAddress: '서울 강남구 삼성로 212',
    complexName: '은마아파트',
    aliases: ['은마', '대치 은마아파트'],
    builtYear: 1979,
  },
  {
    complexId: '11440-0001',
    parcelAddress: '서울 마포구 아현동 777',
    roadAddress: '서울 마포구 마포대로 195',
    complexName: '마포래미안푸르지오',
    aliases: ['마래푸'],
    builtYear: 2014,
  },
]

const deposits = [51000, 52000, 53000, 54000, 55000, 56000, 57000, 58000, 59000, 60000, 61000, 62000]
const contractDates = [
  '2025-09-10', '2025-10-10', '2025-11-10', '2025-12-10',
  '2026-01-10', '2026-02-10', '2026-03-10', '2026-04-10',
  '2026-05-10', '2026-06-10', '2026-07-10', '2026-07-20',
]

export const SAMPLE_TRANSACTIONS: RentalTransaction[] = deposits.map((deposit, index) => ({
  parcelAddress: '서울 강남구 대치동 316',
  roadAddress: '서울 강남구 삼성로 212',
  complexName: index === 0 ? '대치 은마아파트' : '은마아파트',
  areaM2: 84.43,
  contractDate: contractDates[index],
  depositManwon: deposit,
  monthlyRentManwon: 0,
  floor: (index % 10) + 1,
}))
