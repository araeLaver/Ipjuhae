import { Metadata } from 'next'
import { queryOne } from '@/lib/db'
import { CommunityPostView } from '@/components/community/community-post-view'

/**
 * 글 하나가 곧 유입 경로다. 검색 결과와 링크 미리보기에 제목·요약이 제대로 뜨도록
 * 서버에서 메타데이터를 만든다. 화면 자체는 클라이언트 컴포넌트가 그린다.
 */
export const revalidate = 300

interface PostMeta {
  title: string
  body: string
  audience: string
}

async function loadMeta(id: string): Promise<PostMeta | null> {
  try {
    return await queryOne<PostMeta>(
      `SELECT title, body, audience FROM community_posts
        WHERE id = $1 AND deleted_at IS NULL AND hidden_at IS NULL`,
      [id]
    )
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const post = await loadMeta(id)
  if (!post) return { title: '입주해 커뮤니티' }

  const description = post.body.replace(/\s+/g, ' ').slice(0, 155)
  const title = `${post.title} | 입주해 커뮤니티`

  return {
    title,
    description,
    // 역할 판 글은 로그인해야 읽히므로 검색에 올리지 않는다.
    robots: post.audience === 'all' ? undefined : { index: false, follow: false },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `/community/${id}` },
  }
}

export default async function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  // `params`를 서버에서 풀어서 넘긴다. 예전에는 Promise를 그대로 넘기고 클라이언트에서
  // `React.use()`로 풀었는데, `use()`는 React 19 API인 반면 이 저장소의 react는 18.3이다.
  // 여기서 await하면 그 의존이 사라지고 화면도 단독으로 렌더·검증할 수 있다.
  const { id } = await params
  return <CommunityPostView id={id} />
}
