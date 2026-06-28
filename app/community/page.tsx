'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, PenLine, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type CommunitySpace = 'tenant' | 'landlord'
type UserType = CommunitySpace | 'admin'

interface CommunityPost {
  id: string
  space: CommunitySpace
  category: string
  title: string
  content: string
  viewCount: number
  commentCount: number
  createdAt: string
  author: {
    name: string
    userType: string
  }
}

interface CurrentUser {
  id: string
  email: string
  name: string | null
  userType: UserType
}

const spaceLabels: Record<CommunitySpace, string> = {
  tenant: '세입자 커뮤니티',
  landlord: '집주인 커뮤니티',
}

const spaceDescriptions: Record<CommunitySpace, string> = {
  tenant: '집 구하기, 동네 정보, 계약 전 확인할 내용을 나누는 공간',
  landlord: '매물 운영, 세입자 응대, 임대 관리 노하우를 나누는 공간',
}

const categoryLabels: Record<string, string> = {
  general: '자유',
  question: '질문',
  tip: '팁',
  review: '후기',
}

export default function CommunityPage() {
  const [space, setSpace] = useState<CommunitySpace>('tenant')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    category: 'general',
    title: '',
    content: '',
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    loadPosts(space)
  }, [space])

  const loadPosts = async (targetSpace: CommunitySpace) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/community/posts?space=${targetSpace}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '커뮤니티 글을 불러오지 못했습니다')
      setPosts(data.posts)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const canPost = !!user && (user.userType === space || user.userType === 'admin')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canPost) {
      toast.error('해당 커뮤니티에 글을 작성할 권한이 없습니다')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, space }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '글 작성에 실패했습니다')

      setPosts((current) => [data.post, ...current])
      setForm({ category: 'general', title: '', content: '' })
      toast.success('커뮤니티 글이 등록되었습니다')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">커뮤니티</h1>
            <p className="text-muted-foreground">세입자와 집주인이 각자의 경험을 나누는 공간입니다</p>
          </div>
          <div className="flex gap-2">
            {(['tenant', 'landlord'] as CommunitySpace[]).map((item) => (
              <Button
                key={item}
                type="button"
                variant={space === item ? 'default' : 'outline'}
                onClick={() => setSpace(item)}
              >
                {spaceLabels[item]}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  {spaceLabels[space]}
                </CardTitle>
                <CardDescription>{spaceDescriptions[space]}</CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PenLine className="h-5 w-5" />
                  글쓰기
                </CardTitle>
                <CardDescription>
                  {canPost
                    ? `${spaceLabels[space]}에 글을 남겨보세요`
                    : user
                      ? '현재 계정 유형과 다른 커뮤니티에는 글을 작성할 수 없습니다'
                      : '로그인 후 커뮤니티 글을 작성할 수 있습니다'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {canPost ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">분류</Label>
                      <select
                        id="category"
                        value={form.category}
                        onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">제목</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                        maxLength={120}
                        placeholder="제목을 입력하세요"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="content">내용</Label>
                      <Textarea
                        id="content"
                        value={form.content}
                        onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                        maxLength={3000}
                        placeholder="질문, 경험, 팁을 작성하세요"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" loading={isSubmitting}>
                      등록
                    </Button>
                  </form>
                ) : (
                  <Link href={user ? (user.userType === 'landlord' ? '/landlord' : '/profile') : '/login'}>
                    <Button variant="outline" className="w-full">
                      {user ? '내 공간으로 이동' : '로그인'}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                최신 글
              </CardTitle>
              <CardDescription>{spaceLabels[space]}의 최근 대화입니다</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                  <Search className="h-8 w-8" />
                  <p className="text-sm">아직 등록된 글이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y">
                  {posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/community/${post.id}`}
                      className="block py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{categoryLabels[post.category] ?? post.category}</Badge>
                            <h2 className="truncate text-base font-semibold">{post.title}</h2>
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                          <p className="text-xs text-muted-foreground">
                            {post.author.name} · {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <p>댓글 {post.commentCount}</p>
                          <p>조회 {post.viewCount}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  )
}
