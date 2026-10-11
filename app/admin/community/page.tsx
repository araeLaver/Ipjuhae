import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { query } from '@/lib/db'
import { OPERATOR_REPLY_SQL } from '@/lib/community-answers'
import { AUDIENCE_LABELS, type CommunityAudience } from '@/lib/community'

export const dynamic = 'force-dynamic'
export const metadata = { title: '질문 답변 운영', robots: { index: false, follow: false } }
interface Question { id: string; title: string; audience: CommunityAudience; created_at: string; has_operator_reply: boolean }
export default async function Questions({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getCurrentUser()
  if (user?.user_type !== 'admin') redirect('/login')
  const status = (await searchParams).status === 'answered' ? 'answered' : 'waiting'
  let questions: Question[] | null
  try {
    questions = await query<Question>(`
      SELECT * FROM (
        SELECT p.id, p.title, p.audience, p.created_at, ${OPERATOR_REPLY_SQL} AS has_operator_reply
        FROM community_posts p LEFT JOIN users author ON author.id = p.author_id
        WHERE p.hidden_at IS NULL AND p.deleted_at IS NULL AND author.user_type IS DISTINCT FROM 'admin'
      ) questions
      WHERE has_operator_reply = $1
      ORDER BY created_at ASC LIMIT 101
    `, [status === 'answered'])
  } catch { questions = null }
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">질문 답변 운영</h1>
    <p className="text-sm text-muted-foreground">일반 사용자의 공개·역할 게시판 질문을 오래된 순서로 확인합니다. 운영자 댓글이 공개 상태로 있을 때만 답변 있음으로 표시합니다. 질문이 해결됐다는 뜻은 아닙니다.</p>
    <nav className="flex gap-4" aria-label="답변 상태 필터"><Link aria-current={status === 'waiting' ? 'page' : undefined} className="underline" href="/admin/community">답변 대기</Link><Link aria-current={status === 'answered' ? 'page' : undefined} className="underline" href="/admin/community?status=answered">운영자 답변 있음</Link></nav>
    {questions === null ? <p role="alert">질문 목록을 불러오지 못했습니다. <Link href={`/admin/community?status=${status}`} className="underline">다시 확인하기</Link></p> : questions.length === 0 ? <p>이 상태의 질문이 없습니다.</p> : <ul className="space-y-3">{questions.slice(0, 100).map(question => <li key={question.id} className="rounded-lg border bg-white p-4">
      <h2 className="font-semibold">{question.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{AUDIENCE_LABELS[question.audience]} · 등록 {new Date(question.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 등록 후 {Math.max(0, Math.floor((Date.now() - Date.parse(question.created_at)) / 3600000))}시간</p>
      <Link href={`/community/${question.id}${question.has_operator_reply ? '' : '#reply'}`} className="mt-3 inline-block font-semibold text-primary underline">{question.has_operator_reply ? '질문과 답변 확인' : '질문 확인하고 답변하기'}</Link>
    </li>)}</ul>}
    {questions && questions.length > 100 && <p className="text-sm">오래된 100개를 표시합니다. 대기 질문에 답변한 뒤 새로고침해 다음 질문을 확인하세요.</p>}
    <p className="text-sm text-muted-foreground">답변 담당자와 처리 시간은 운영에서 정해야 합니다. 사용자에게 임의로 처리 시간을 약속하지 않습니다.</p>
  </div>
}
