'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquare } from 'lucide-react'
import {
  AUDIENCE_LABELS,
  canPostTo,
  readableAudiences,
  userTypeToAudience,
  type CommunityAudience,
} from '@/lib/community'

interface Post {
  id: string
  audience: CommunityAudience
  category: string | null
  title: string
  comment_count: number
  view_count: number
  created_at: string
  author_name: string | null
}

export default function CommunityPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<CommunityAudience>('all')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [writing, setWriting] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<CommunityAudience>('all')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUserType(d?.user?.userType ?? null))
      .catch(() => setUserType(null))
      .finally(() => setReady(true))
  }, [])

  const tabs = readableAudiences(userType)

  const load = useCallback(async (aud: CommunityAudience) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/community/posts?audience=${aud}`)
      if (res.status === 401) {
        router.push('/login?redirect=/community')
        return
      }
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (ready) load(tab)
  }, [ready, tab, load])

  const ownAudience = userTypeToAudience(userType)

  async function submit() {
    if (!title.trim() || !body.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, title, body }),
      })
      if (res.ok) {
        setTitle('')
        setBody('')
        setWriting(false)
        load(tab)
      } else {
        const d = await res.json().catch(() => null)
        alert(d?.error ?? '작성에 실패했습니다')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">커뮤니티</h1>
            <p className="text-sm text-muted-foreground">임차인·임대인·공인중개사가 정보를 나누는 공간</p>
          </div>
          <Button onClick={() => { setAudience(ownAudience ?? 'all'); setWriting((v) => !v) }}>
            글쓰기
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((a) => (
            <button
              key={a}
              onClick={() => setTab(a)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === a ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              {AUDIENCE_LABELS[a]}
            </button>
          ))}
        </div>

        {writing && (
          <Card className="mb-6 space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              {tabs.filter((a) => canPostTo(userType, a)).map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    audience === a ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {AUDIENCE_LABELS[a]} 게시판
                </button>
              ))}
            </div>
            <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            <Textarea placeholder="내용을 입력하세요" value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={10000} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWriting(false)}>취소</Button>
              <Button onClick={submit} disabled={submitting || !title.trim() || !body.trim()}>
                {submitting ? '등록 중…' : '등록'}
              </Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : posts.length === 0 ? (
          <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="아직 글이 없어요" description="첫 글을 남겨보세요." />
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`}>
                  <Card className="p-4 transition-shadow hover:shadow-card">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                        {AUDIENCE_LABELS[p.audience]}
                      </span>
                      <span>{p.author_name ?? '익명'}</span>
                    </div>
                    <p className="font-semibold">{p.title}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span>댓글 {p.comment_count}</span>
                      <span>조회 {p.view_count}</span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
