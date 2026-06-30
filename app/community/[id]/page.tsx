'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

interface CommunityComment {
  id: string
  content: string
  createdAt: string
  author: {
    name: string
    userType: string
  }
}

interface CurrentUser {
  userType: UserType
}

const spaceLabels: Record<CommunitySpace, string> = {
  tenant: '세입자 커뮤니티',
  landlord: '집주인 커뮤니티',
}

const categoryLabels: Record<string, string> = {
  general: '자유',
  question: '질문',
  tip: '팁',
  review: '후기',
}

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
  }, [])

  const loadPost = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/community/posts/${id}`)
      const data = await response.json()
      if (response.status === 404) {
        router.push('/community')
        return
      }
      if (!response.ok) throw new Error(data.error || '게시글을 불러오지 못했습니다')
      setPost(data.post)
      setComments(data.comments)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!params.id) return
    loadPost(params.id)
  }, [loadPost, params.id])

  const canComment = !!post && !!user && (user.userType === post.space || user.userType === 'admin')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!post) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '댓글 작성에 실패했습니다')

      setComments((current) => [...current, data.comment])
      setPost((current) => current ? { ...current, commentCount: current.commentCount + 1 } : current)
      setContent('')
      toast.success('댓글이 등록되었습니다')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="lg">
        <div className="py-16 text-center text-muted-foreground">불러오는 중...</div>
      </PageContainer>
    )
  }

  if (!post) return null

  return (
    <PageContainer maxWidth="lg">
      <div className="space-y-6">
        <Link href="/community">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            커뮤니티로 돌아가기
          </Button>
        </Link>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{spaceLabels[post.space]}</Badge>
              <Badge variant="secondary">{categoryLabels[post.category] ?? post.category}</Badge>
            </div>
            <CardTitle className="text-2xl">{post.title}</CardTitle>
            <CardDescription>
              {post.author.name} · {new Date(post.createdAt).toLocaleString('ko-KR')} · 조회 {post.viewCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap leading-7">{post.content}</p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              댓글 {post.commentCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {comments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">아직 댓글이 없습니다</p>
            ) : (
              <div className="divide-y">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-2 py-4">
                    <p className="text-sm font-medium">{comment.author.name}</p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{comment.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {canComment ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={1000}
                  placeholder="댓글을 입력하세요"
                  required
                />
                <Button type="submit" loading={isSubmitting}>
                  댓글 등록
                </Button>
              </form>
            ) : (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                로그인한 뒤 해당 역할의 커뮤니티에서 댓글을 작성할 수 있습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
