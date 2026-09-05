import { Metadata } from 'next'
import { ServicePreview } from '@/components/preview/service-preview'

export const metadata: Metadata = {
  title: '서비스 미리보기 - 입주해',
  description: '가입 없이 입주해의 로그인 후 화면을 합성 예시 데이터로 둘러보세요.',
  robots: { index: false, follow: false },
}

export default function PreviewPage() {
  return <ServicePreview />
}
