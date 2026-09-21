import { query } from '@/lib/db'

/**
 * 첫 화면에 쓸 글을 서버에서 읽는다.
 *
 * 클라이언트에서 fetch 하면 검색엔진에는 빈 화면이 색인된다. 글 하나하나가
 * 유입 경로인데 그러면 아무 의미가 없다. 그래서 여기서 직접 읽는다.
 *
 * DB가 죽어도 첫 화면은 떠야 한다. 도구와 소개는 글 없이도 쓸 수 있다.
 */

export interface HomePost {
  id: string
  title: string
  body: string
  comment_count: number
  view_count: number
  created_at: string
  author_role: string
}

/** 연재 하나. 제목 앞의 "N화."로 순서를 잡는다. */
export interface GuideSeries {
  key: string
  title: string
  lead: string
  posts: Array<HomePost & { episode: number; subject: string }>
}

const SERIES = [
  {
    key: 'deungi',
    prefix: '등기부 뜯어보기',
    title: '등기부 뜯어보기',
    lead: '계약서에 도장 찍기 전에 등기부에서 무엇을 봐야 하는지, 볼 순서대로 정리했습니다.',
  },
  {
    key: 'landlord',
    prefix: '임대인 노트',
    title: '임대인 노트',
    lead: '세를 놓는 쪽에서 확인할 것. 공실보다 비싼 게 무엇인지부터 봅니다.',
  },
] as const

/** "등기부 뜯어보기 3화. 근저당과 순위" -> { episode: 3, subject: '근저당과 순위' } */
function parseTitle(title: string, prefix: string) {
  const rest = title.slice(prefix.length).trim()
  const m = rest.match(/^(\d+)화\.\s*(.+)$/)
  if (!m) return { episode: Number.MAX_SAFE_INTEGER, subject: rest }
  return { episode: Number(m[1]), subject: m[2] }
}

/**
 * DB가 느려도 첫 화면은 뜬다.
 *
 * try/catch는 오류만 잡는다. 연결이 실패가 아니라 **매달리면** 서버 컴포넌트가
 * 끝나지 않고 HTML 스트림이 열린 채로 남는다. 방문자에게는 빈 화면이다.
 * 그래서 시간 제한을 따로 건다. 글을 못 읽는 것보다 홈이 멈추는 게 나쁘다.
 */
const QUERY_TIMEOUT_MS = 2500

function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), QUERY_TIMEOUT_MS)
    p.then((v) => {
      clearTimeout(timer)
      resolve(v)
    }).catch(() => {
      clearTimeout(timer)
      resolve(fallback)
    })
  })
}

async function fetchPublicPosts(): Promise<HomePost[]> {
  try {
    return await withTimeout(
      query<HomePost>(
      `SELECT id, title, body, comment_count, view_count, created_at,
              COALESCE(u.user_type, 'guest') AS author_role
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.author_id
        WHERE p.deleted_at IS NULL
          AND p.hidden_at IS NULL
          AND p.audience = 'all'
        ORDER BY p.created_at DESC
        LIMIT 200`
      ),
      []
    )
  } catch {
    // 글을 못 읽어도 첫 화면은 뜬다.
    return []
  }
}

export interface HomeContent {
  series: GuideSeries[]
  /** 운영자 글이 아닌, 사람들이 올린 질문. 최근 것부터. */
  questions: HomePost[]
  guideCount: number
}

export async function getHomeContent(): Promise<HomeContent> {
  const posts = await fetchPublicPosts()

  const series: GuideSeries[] = SERIES.map((s) => {
    const matched = posts
      .filter((p) => p.author_role === 'admin' && p.title.startsWith(s.prefix))
      .map((p) => ({ ...p, ...parseTitle(p.title, s.prefix) }))
      .sort((a, b) => a.episode - b.episode)
    return { key: s.key, title: s.title, lead: s.lead, posts: matched }
  }).filter((s) => s.posts.length > 0)

  const guideIds = new Set(series.flatMap((s) => s.posts.map((p) => p.id)))
  const questions = posts.filter((p) => !guideIds.has(p.id)).slice(0, 6)

  return {
    series,
    questions,
    guideCount: guideIds.size,
  }
}

/** 본문에서 미리보기 한 줄을 뽑는다. 제목이 반복되면 빼고 첫 문단만. */
export function excerpt(body: string, max = 92): string {
  const first = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0]
  if (!first) return ''
  return first.length > max ? `${first.slice(0, max)}…` : first
}
