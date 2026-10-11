import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function GuidePage({ params }: { params: Promise<{ episode: string }> }) {
  const { episode } = await params
  if (!/^(?:[1-9]|1[0-2])$/.test(episode)) notFound()
  let post: { id: string } | null
  try {
    post = await queryOne<{ id: string }>(`
      SELECT p.id FROM community_posts p JOIN users u ON u.id = p.author_id
      WHERE u.user_type = 'admin' AND p.audience = 'all'
        AND p.hidden_at IS NULL AND p.deleted_at IS NULL
        AND p.title LIKE $1
      ORDER BY p.created_at DESC LIMIT 1
    `, [`등기부 뜯어보기 ${episode}화.%`])
  } catch {
    return <main className="mx-auto max-w-xl space-y-4 px-4 py-12">
      <h1 className="text-xl font-bold">관련 글을 불러오지 못했습니다</h1>
      <a className="block underline" href={`/guides/deungi/${episode}`}>다시 불러오기</a>
      <Link className="block underline" href="/community#ask">커뮤니티에 질문하기</Link>
      <Link className="block underline" href="/check">보증금 점검으로 돌아가기</Link>
    </main>
  }
  if (post) redirect(`/community/${post.id}`)
  return <main className="mx-auto max-w-xl space-y-4 px-4 py-12">
    <h1 className="text-xl font-bold">이 글을 찾을 수 없습니다</h1>
    <Link className="block underline" href="/community#ask">커뮤니티에 질문하기</Link>
    <Link className="block underline" href="/check">보증금 점검으로 돌아가기</Link>
  </main>
}
