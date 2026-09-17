'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { ArrowRight, MessageSquare, PenLine } from 'lucide-react'
import {
  AUDIENCE_LABELS,
  canPostTo,
  roleLabel,
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
  author_role: string
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}시간 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function CommunityBoard() {
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
      const data = await res.json().catch(() => ({}))
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (ready) load(tab)
  }, [ready, tab, load])

  const ownAudience = userTypeToAudience(userType)

  // 운영자가 정리한 글은 목록에 섞지 않고 위에 따로 세운다.
  // 처음 온 사람이 읽을 것부터 보여야 다시 온다.
  const { guideSeries, guideCount, threads } = useMemo(() => {
    // 연재물이라 최신순으로 두면 마지막 화부터 보인다. 회차 순으로 세운다.
    const episodeNo = (t: string) => Number(/(\d+)화/.exec(t)?.[1] ?? 999)
    const guides = posts.filter((p) => p.author_role === 'admin')

    const bySeries = new Map<string, Post[]>()
    for (const g of guides) {
      const key = g.category ?? '안내'
      if (!bySeries.has(key)) bySeries.set(key, [])
      bySeries.get(key)!.push(g)
    }
    for (const list of bySeries.values()) list.sort((a, b) => episodeNo(a.title) - episodeNo(b.title))

    return {
      guideSeries: [...bySeries.entries()],
      guideCount: guides.length,
      threads: posts.filter((p) => p.author_role !== 'admin'),
    }
  }, [posts])

  /** 회차 번호를 떼고 제목만 남긴다. 목록에서는 연재명이 이미 머리에 있다. */
  const shortTitle = (t: string) => t.replace(/^.*?(\d+)화\.\s*/, '')

  function startWriting() {
    if (!userType) {
      router.push('/login?redirect=/')
      return
    }
    setAudience(ownAudience ?? 'all')
    setWriting((v) => !v)
  }

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
    <div className="min-h-screen bg-background">
      <Header />

      {/* 무엇을 하는 곳인지 한 줄로. 들어온 사람이 3초 안에 판단한다. */}
      <section className="border-b border-border bg-card">
        <div className="container mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">입주해 커뮤니티</p>
          <h1 className="mt-2 text-balance text-2xl font-extrabold leading-snug sm:text-3xl">
            계약 전에 물어보는 곳
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            등기부, 보증금, 특약, 세입자 확인. 혼자 판단하기 어려운 것들을
            임차인·임대인·공인중개사가 함께 봅니다.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link
              href="/preview"
              className="group flex items-center justify-between rounded-xl bg-primary px-4 py-3.5 text-primary-foreground transition hover:brightness-105"
            >
              <span>
                <span className="block text-sm font-bold">서비스 미리보기</span>
                <span className="block text-xs opacity-80">가입 없이 화면을 둘러보세요</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/about"
              className="group flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3.5 transition hover:border-primary/40"
            >
              <span>
                <span className="block text-sm font-bold">입주해가 하는 일</span>
                <span className="block text-xs text-muted-foreground">카드 발급 파일럿 신청</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <main className="container mx-auto max-w-3xl px-4 py-8">
        {/* 질문을 남기게 하는 자리. 작은 버튼 하나로는 아무도 쓰지 않는다. */}
        <Card className="mb-8 border-primary/25 bg-card p-5">
          <p className="text-base font-extrabold">이 집, 계약해도 될까요?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            지역과 보증금, 등기부에서 본 것만 적어주시면 같이 봅니다.
            주소와 건물명은 적지 말아주세요.
          </p>
          <button
            type="button"
            onClick={startWriting}
            className="mt-4 flex w-full items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-left text-sm text-muted-foreground transition hover:border-primary/40"
          >
            <PenLine className="h-4 w-4 shrink-0" />
            지금 막히는 게 무엇인가요
          </button>
          <p className="mt-2.5 text-xs text-muted-foreground">
            운영자가 직접 답합니다. 익명으로 쓸 수 있어요.
          </p>
        </Card>

        {/* 운영자가 정리한 것. 가로 스크롤은 대부분이 화면 밖으로 밀려 안 읽힌다. */}
        {guideCount > 0 && (
          <section className="mb-10">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">입주해가 정리한 것</h2>
              <span className="text-xs text-muted-foreground">{guideCount}편</span>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              계약 전에 확인할 것을 순서대로 정리했습니다.
            </p>

            <div className="space-y-5">
              {guideSeries.map(([series, list]) => (
                <div key={series} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-baseline justify-between border-b border-border bg-muted/40 px-4 py-3">
                    <h3 className="text-sm font-bold">{series}</h3>
                    <span className="text-xs text-muted-foreground">{list.length}편</span>
                  </div>
                  <ol className="divide-y divide-border">
                    {list.map((g, i) => (
                      <li key={g.id}>
                        <Link
                          href={`/community/${g.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                        >
                          <span className="w-6 shrink-0 text-sm font-bold tabular-nums text-primary">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                            {shortTitle(g.title)}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 게시판 */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((a) => (
              <button
                key={a}
                onClick={() => setTab(a)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  tab === a
                    ? 'bg-foreground text-background'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {AUDIENCE_LABELS[a]}
              </button>
            ))}
          </div>
          <Button onClick={startWriting} className="shrink-0 gap-1.5">
            <PenLine className="h-4 w-4" />
            글쓰기
          </Button>
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
            <Textarea
              placeholder="어떤 상황인지 적어주세요. 지역은 동까지만, 주소·건물명은 적지 말아주세요."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={10000}
            />
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
        ) : threads.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/60" />
            <div>
              <p className="font-semibold">아직 질문이 없어요</p>
              <p className="mt-1 text-sm text-muted-foreground">
                계약 전에 막히는 게 있으면 남겨주세요. 같은 걸 겪은 사람이 답할 수 있습니다.
              </p>
            </div>
            <Button onClick={startWriting} variant="outline" className="mt-1 gap-1.5">
              <PenLine className="h-4 w-4" />
              첫 글 남기기
            </Button>
          </Card>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {threads.map((p) => (
              <li key={p.id}>
                <Link href={`/community/${p.id}`} className="block px-4 py-4 transition-colors hover:bg-muted/50">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{AUDIENCE_LABELS[p.audience]}</span>
                    <span>{p.author_name ?? '익명'}</span>
                    {roleLabel(p.author_role) && (
                      <span
                        className={
                          'rounded px-1.5 py-0.5 font-medium ' +
                          (p.author_role === 'admin'
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border text-foreground/70')
                        }
                      >
                        {roleLabel(p.author_role)}
                      </span>
                    )}
                    <span className="ml-auto">{timeAgo(p.created_at)}</span>
                  </div>
                  <p className="font-semibold leading-snug">{p.title}</p>
                  <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                    <span>댓글 {p.comment_count}</span>
                    <span>조회 {p.view_count}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
