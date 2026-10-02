import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import DeleteAccountForm from './request-form'

export default async function DeleteAccountPage() {
  const user = await getCurrentUser()
  return <main className="mx-auto max-w-lg p-6 space-y-4">
    <h1 className="text-2xl font-bold">입주해 계정·데이터 삭제 요청</h1>
    <p>프로필을 완성하지 않아도 삭제를 요청할 수 있습니다. 본인 확인을 위해 기존 계정으로 로그인해주세요.</p>
    <p>탈퇴하면 프로필·인증서류·작성한 커뮤니티 글과 댓글·푸시 토큰을 삭제합니다. 참여한 대화와 계약 전 대화 요청은 상대방 목록에서도 삭제됩니다. 등록 매물은 비공개로 전환합니다. 복구할 수 없습니다.</p>
    <p>외부 저장 파일은 데이터 삭제와 함께 정리 요청을 저장하고, 실패한 파일은 재시도합니다. 공유 계약·신뢰 자료가 있으면 자동 삭제를 중단하고 개별 검토를 안내합니다.</p>
    {user ? <DeleteAccountForm /> : <Link className="underline" href="/login?redirect=%2Faccount%2Fdelete">로그인 후 삭제 요청</Link>}
    <p>자동 처리 실패 또는 로그인 불가 시 <a className="underline" href="mailto:support@ipjuhae.com?subject=계정%20삭제%20요청">support@ipjuhae.com</a>으로 요청해주세요. 비밀번호나 인증서류를 이메일에 보내지 마세요.</p>
    <Link className="underline" href="/privacy">개인정보처리방침</Link>
  </main>
}
