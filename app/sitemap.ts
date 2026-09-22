import { MetadataRoute } from 'next'
import { query } from '@/lib/db'

const BASE_URL = 'https://www.ipjuhae.com'

/**
 * 첫 화면이 커뮤니티가 되면서 sitemap의 목적이 바뀌었다.
 *
 * 전에는 랜딩 한 장을 알리는 게 전부였지만, 이제는 **글 하나하나가 유입 경로**다.
 * "성남 원룸 보증금 계약 전 확인" 같은 검색으로 들어오게 하려면 글이 색인돼야 한다.
 * 그래서 공개된 글('전체' 판, 삭제되지 않은 것)을 전부 싣는다.
 */
export const revalidate = 3600

interface PostRow {
  id: string
  updated_at: string | null
  created_at: string
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/check`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/policy`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/install`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/community`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ]

  let posts: PostRow[] = []
  try {
    // 로그인 없이 읽히는 글만 싣는다. 역할 판 글은 색인 대상이 아니다.
    posts = await query<PostRow>(
      `SELECT id, updated_at, created_at
         FROM community_posts
        WHERE deleted_at IS NULL AND hidden_at IS NULL AND audience = 'all'
        ORDER BY created_at DESC
        LIMIT 5000`
    )
  } catch {
    // 색인 목록 때문에 sitemap 전체가 죽으면 안 된다. 정적 경로만이라도 내보낸다.
    return staticRoutes
  }

  return [
    ...staticRoutes,
    ...posts.map((p) => ({
      url: `${BASE_URL}/community/${p.id}`,
      lastModified: new Date(p.updated_at ?? p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}
