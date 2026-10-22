import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

export const metadata: Metadata = {
  title: '입주해 서비스 안내',
  description: '보증금 점검, 후보 집 비교와 계약 전 확인 기능을 확인하세요.',
}

export default function AboutPage(): never {
  permanentRedirect('/service')
}
