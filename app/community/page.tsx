import { redirect } from 'next/navigation'

/** 커뮤니티는 이제 첫 화면이다. 예전 주소로 들어오는 링크를 잃지 않게 넘겨준다. */
export default function CommunityRedirect() {
  redirect('/')
}
