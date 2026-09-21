import type { Metadata } from 'next'
import { CommunityBoard } from '@/components/community/community-board'

/**
 * 게시판.
 *
 * 한동안 `/`로 넘겨줬다. 첫 화면을 게시판으로 쓰던 시절의 흔적인데,
 * 이제 `/`는 도구와 글을 함께 보여주는 홈이 됐으므로 게시판은 제자리로 돌아온다.
 */
export const metadata: Metadata = {
  title: '계약 전에 물어보는 곳',
  description:
    '임차인·임대인·공인중개사가 계약 전에 확인할 것을 나누는 공간. 가입하지 않아도 읽고 쓸 수 있습니다.',
  alternates: { canonical: '/community' },
}

export default function CommunityPage() {
  return <CommunityBoard />
}
