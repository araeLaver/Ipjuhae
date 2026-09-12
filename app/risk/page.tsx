import { Metadata } from 'next'
import { RiskCheck } from '@/components/risk/risk-check'

export const metadata: Metadata = {
  title: '이 보증금, 시세에 비해 어떤가요',
  description:
    '같은 단지 같은 평형의 최근 실거래와 비교해 보증금 위치를 알려드립니다. 등기부·권리관계는 확인하지 않습니다.',
  robots: { index: false, follow: false },
}

export default function RiskPage() {
  return <RiskCheck />
}
