'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { AuthorRoleBadge } from '@/components/community/author-role-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AUDIENCE_LABELS, authorDisplayName, roleLabel, type CommunityAudience } from '@/lib/community'

interface Post {
  id: string
  audience: CommunityAudience
  title: string
  body: string
  view_count: number
  comment_count: number
  created_at: string
  /**
   * 서버가 내려주는 글쓴이 역할. 운영자 답을 옆 사람 추측과 구분하는 근거다.
   * 표시 이름도 이 값에서 만든다 — 서버는 이름을 내려보내지 않는다(DOW-1236).
   */
  author_role: string | null
  /** 보고 있는 사람이 글쓴이인가. 본인 글에는 신고 버튼을 세우지 않는다. */
  is_author: boolean
}
interface Comment {
  id: string
  body: string
  created_at: string
  author_role: string | null
}

/** 글을 읽을 수 없을 때 무엇이 막았는지. 403은 로그인이면 풀리는 경우와 아닌 경우가 갈린다. */
type LoadError = { message: string; forbidden: boolean }

const REPORT_REASON_HINTS = ['개인정보 노출', '광고·스팸', '욕설·혐오', '허위 정보']

export function CommunityPostView({ id }: { id: string }) {
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  /** 댓글 조회 실패. `comments`가 빈 배열인 것과 구분해야 "댓글 0"으로 보이지 않는다. */
  const [commentsFailed, setCommentsFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<LoadError | null>(null)
  const [viewerType, setViewerType] = useState<string | null>(null)
  const [viewerKnown, setViewerKnown] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  /** 내 신고로 이 글이 숨겨졌는가. 본문 자리를 결과 화면으로 바꾸는 조건이다. */
  const [hiddenByReport, setHiddenByReport] = useState(false)

  // 403을 받았을 때 "로그인하면 보인다"인지 "역할이 달라서 못 본다"인지 갈라야 해서
  // 보는 사람이 누구인지 먼저 확인한다. 목록 화면과 같은 경로를 쓴다.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setViewerType(d?.user?.userType ?? null))
      .catch(() => setViewerType(null))
      .finally(() => setViewerKnown(true))
  }, [])

  const loadComments = useCallback(async () => {
    try {
      const cRes = await fetch(`/api/community/posts/${id}/comments`)
      if (!cRes.ok) {
        setCommentsFailed(true)
        return
      }
      setComments((await cRes.json()).comments ?? [])
      setCommentsFailed(false)
    } catch {
      setCommentsFailed(true)
    }
  }, [id])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/community/posts/${id}`)
      if (!res.ok) {
        // 이 API는 401을 반환하지 않는다. 읽기는 비로그인에도 열려 있고, 역할 판 글은
        // `posts/[id]/route.ts`에서 403이다. 예전의 401 분기는 한 번도 타지 않는
        // 사문화된 코드라 지웠다. 실제로 오는 403을 처리한다.
        setError({
          message: (await res.json().catch(() => null))?.error ?? '게시글을 불러오지 못했습니다',
          forbidden: res.status === 403,
        })
        return
      }
      setError(null)
      setPost((await res.json()).post)
      await loadComments()
    } finally {
      setLoading(false)
    }
  }, [id, loadComments])

  useEffect(() => { load() }, [load])

  async function submitComment() {
    if (!body.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/community/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) { setBody(''); load() }
      else toast.error((await res.json().catch(() => null))?.error ?? '댓글 작성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 익명 게시판이라 신고 수단이 반드시 있어야 한다. 로그인 없이도 신고할 수 있다.
   * 사유 입력은 화면 안 패널로 받는다 — `window.prompt`는 줄바꿈이 안 되고
   * 모바일에서 브랜드와 분리된 시스템 대화상자로 뜬다. 결과 안내는 DOW-1136이
   * 보드에서 쓰는 것과 같은 sonner `toast`다.
   */
  async function submitReport() {
    const reason = reportReason.trim()
    if (!reason) return
    setReportSubmitting(true)
    try {
      const res = await fetch('/api/community/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id, reason }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error ?? '신고를 접수하지 못했습니다')
        return
      }
      setReporting(false)
      setReportReason('')
      if (data?.hidden) {
        toast.success('신고가 접수됐습니다. 신고가 쌓여 이 글은 보이지 않게 처리됐습니다.')
        // 자동 이동하지 않는다(DOW-1161 패턴 D-2). 사용자는 신고를 눌렀지 화면을 떠나겠다고
        // 한 적이 없고, 3초짜리 토스트와 화면 전환이 겹치면 둘 중 하나를 놓친다.
        // 보던 글이 사라진 이유를 이 자리에서 말하고, 이동은 버튼으로 받는다.
        setHiddenByReport(true)
      } else {
        toast.success('신고가 접수됐습니다. 운영자가 확인합니다.')
      }
    } finally {
      setReportSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← 커뮤니티</Link>

        {hiddenByReport ? (
          <Card className="p-6">
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10" />}
              title="신고가 접수돼 이 글은 보이지 않게 됐습니다"
              description="운영자가 확인합니다. 결과는 따로 안내되지 않습니다."
              action={{ label: '커뮤니티로 돌아가기', onClick: () => router.push('/') }}
            />
          </Card>
        ) : loading || (error?.forbidden && !viewerKnown) ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">{error.message}</p>
            {error.forbidden && (
              viewerType === null ? (
                // 임대인 판 글을 SNS에서 열어본 비로그인 사용자가 여기서 끝나지 않게 한다.
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    역할 게시판 글입니다. 로그인하면 이어서 볼 수 있습니다.
                  </p>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/community/${id}`)}`}
                    className={cn(buttonVariants(), 'mt-4')}
                  >
                    로그인하고 이어서 보기
                  </Link>
                </>
              ) : (
                // 로그인은 했는데 역할이 다른 경우. 여기에 로그인 버튼을 세우면 막다른 길이다.
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {roleLabel(viewerType) ?? '지금 계정'}으로는 볼 수 없는 게시판입니다.
                  </p>
                  <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
                    커뮤니티로 돌아가기
                  </Link>
                </>
              )
            )}
          </Card>
        ) : post ? (
          <>
            <Card className="mb-6 p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{AUDIENCE_LABELS[post.audience]}</span>
                <span>{authorDisplayName(post.author_role)}</span>
                <AuthorRoleBadge role={post.author_role} />
                {post.is_author && <span className="rounded border border-border px-1.5 py-0.5">내 글</span>}
              </div>
              <h1 className="text-xl font-bold">{post.title}</h1>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{post.body}</p>
              {!post.is_author && (
                <div className="mt-5 border-t border-border pt-3">
                  {reporting ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">신고 사유를 적어주세요. 운영자만 봅니다.</p>
                      <div className="flex flex-wrap gap-2">
                        {REPORT_REASON_HINTS.map((hint) => (
                          <button
                            key={hint}
                            type="button"
                            onClick={() => setReportReason(hint)}
                            className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70"
                          >
                            {hint}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        placeholder="무엇이 문제인지 적어주세요"
                        rows={3}
                        maxLength={1000}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setReporting(false); setReportReason('') }}
                          disabled={reportSubmitting}
                        >
                          취소
                        </Button>
                        <Button size="sm" onClick={submitReport} disabled={reportSubmitting || !reportReason.trim()}>
                          {reportSubmitting ? '접수 중…' : '신고 접수'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setReporting(true)}
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        신고
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/*
              개수는 `comments.length`를 쓴다. 서버의 `post.comment_count`는 작성 때만 +1 되고
              삭제·숨김에서 줄지 않아, 바로 아래 실제로 그려진 목록과 어긋난다.
              조회에 실패했을 때는 아예 숫자를 내지 않는다 — 실패를 "댓글 0"으로 보여주던 게 이번 결함이다.
            */}
            <h2 className="mb-3 text-sm font-semibold">
              {commentsFailed ? '댓글' : `댓글 ${comments.length}`}
            </h2>
            {commentsFailed ? (
              <Card className="mb-5 flex flex-col items-center gap-2 p-5 text-center">
                <p className="text-sm text-muted-foreground">댓글을 불러오지 못했습니다.</p>
                <Button variant="outline" size="sm" onClick={loadComments}>다시 시도</Button>
              </Card>
            ) : (
              <ul className="mb-5 space-y-3">
                {comments.map((c) => (
                  /*
                    운영자 답은 테두리·바탕을 약하게 달리해 훑을 때 눈에 걸리게 한다. 뜻을 지는 건
                    어디까지나 '운영자' 배지이고 색은 보조다 — 색을 못 읽어도 정보는 그대로다.
                    일반 댓글 쪽은 손대지 않는다. 운영자를 올리려고 질문한 사람을 낮추면 안 된다.
                  */
                  <li
                    key={c.id}
                    className={cn(
                      'rounded-lg border bg-background p-3',
                      c.author_role === 'admin' && 'border-primary/40 bg-primary/5',
                    )}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{authorDisplayName(c.author_role)}</span>
                      <AuthorRoleBadge role={c.author_role} />
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Textarea placeholder="댓글을 입력하세요" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
              <div className="flex justify-end">
                <Button onClick={submitComment} disabled={submitting || !body.trim()}>
                  {submitting ? '등록 중…' : '댓글 등록'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
