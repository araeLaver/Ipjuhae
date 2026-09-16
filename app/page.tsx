import { Metadata } from 'next'
import { CommunityBoard } from '@/components/community/community-board'

/**
 * 첫 화면은 커뮤니티다.
 *
 * 사용자를 모으는 게 목적인데 사전신청 랜딩을 첫 화면에 두면 방문자가 볼 게 없다.
 * 글은 로그인 없이 읽힌다 — 검색·SNS에서 들어온 사람이 바로 읽고,
 * 서비스 소개(/about)와 미리보기(/preview)로는 상단 버튼으로 언제든 넘어간다.
 */
export const metadata: Metadata = {
  title: '입주해 커뮤니티 — 계약 전에 물어보는 곳',
  description:
    '임차인·임대인·공인중개사가 계약 전에 확인할 것을 나누는 공간. 등기부, 보증금, 특약, 세입자 확인까지 실제 사례로 이야기합니다.',
  openGraph: {
    title: '입주해 커뮤니티 — 계약 전에 물어보는 곳',
    description: '임차인·임대인·공인중개사가 계약 전에 확인할 것을 나누는 공간.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '입주해 커뮤니티 — 계약 전에 물어보는 곳',
    description: '임차인·임대인·공인중개사가 계약 전에 확인할 것을 나누는 공간.',
  },
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return <CommunityBoard />
}
