'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { AUDIENCE_LABELS, type CommunityAudience } from '@/lib/community'

interface Post {
  id: string
  audience: CommunityAudience
  title: string
  body: string
  view_count: number
  comment_count: number
  created_at: string
  author_name: string | null
}
interface Comment {
  id: string
  body: string
  created_at: string
  author_name: string | null
}

export function CommunityPostView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/community/posts/${id}`)
      if (res.status === 401) { router.push(`/login?redirect=//${id}`); return }
      if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? '게시글을 불러오지 못했습니다'); return }
      setPost((await res.json()).post)
      const cRes = await fetch(`/api/community/posts/${id}/comments`)
      if (cRes.ok) setComments((await cRes.json()).comments ?? [])
    } finally {
      setLoading(false)
    }
  }, [id, router])

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
      else alert((await res.json().catch(() => null))?.error ?? '댓글 작성 실패')
    } finally {
      setSubmitting(false)
    }
  }

  /** 익명 게시판이라 신고 수단이 반드시 있어야 한다. 로그인 없이도 신고할 수 있다. */
  async function report() {
    const reason = window.prompt(
      '신고 사유를 적어주세요.\n(개인정보 노출, 광고·스팸, 욕설·혐오, 허위 정보 등)'
    )
    if (!reason || !reason.trim()) return
    const res = await fetch('/api/community/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: id, reason: reason.trim() }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? '신고를 접수하지 못했습니다')
      return
    }
    alert(
      data?.hidden
        ? '신고가 접수됐습니다. 신고가 쌓여 이 글은 보이지 않게 처리됐습니다.'
        : '신고가 접수됐습니다. 운영자가 확인합니다.'
    )
    if (data?.hidden) router.push('/')
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← 커뮤니티</Link>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <Card className="p-6 text-center text-muted-foreground">{error}</Card>
        ) : post ? (
          <>
            <Card className="mb-6 p-5">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">{AUDIENCE_LABELS[post.audience]}</span>
                <span>{post.author_name ?? '익명'}</span>
              </div>
              <h1 className="text-xl font-bold">{post.title}</h1>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{post.body}</p>
              <div className="mt-5 flex justify-end border-t border-border pt-3">
                <button
                  type="button"
                  onClick={report}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  신고
                </button>
              </div>
            </Card>

            <h2 className="mb-3 text-sm font-semibold">댓글 {comments.length}</h2>
            <ul className="mb-5 space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg border bg-background p-3">
                  <p className="mb-1 text-xs text-muted-foreground">{c.author_name ?? '익명'}</p>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                </li>
              ))}
            </ul>

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
