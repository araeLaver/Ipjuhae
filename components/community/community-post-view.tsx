'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { AuthorRoleBadge } from '@/components/community/author-role-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog'
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
  is_author?: boolean
  id: string
  body: string
  created_at: string
  author_role: string | null
}

/** 글을 읽을 수 없을 때 무엇이 막았는지. 403은 로그인이면 풀리는 경우와 아닌 경우가 갈린다. */
type LoadError = { message: string; forbidden: boolean; missing?: boolean }

const REPORT_REASON_HINTS = ['개인정보 노출', '광고·스팸', '욕설·혐오', '허위 정보']

export function CommunityPostView({ id }: { id: string }) {
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  /** 댓글 조회 실패. `comments`가 빈 배열인 것과 구분해야 "댓글 0"으로 보이지 않는다. */
  const [commentsTotal, setCommentsTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [countFailed, setCountFailed] = useState(false)
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

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [failureStatus, setFailureStatus] = useState<number | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<'edit' | 'leave' | null>(null)
  const mutationLock = useRef(false)
  const terminal = useRef(false)
  const generation = useRef(0)
  const removedComments = useRef(new Set<string>())
  const returnFocus = useRef<HTMLElement | null>(null)
  const pendingFocus = useRef<'edit-button' | 'edit-cancel' | null>(null)
  const cancelDismissMode = useRef<'discard' | null>(null)
  const leaveHref = useRef('/community')
  const editButton = useRef<HTMLButtonElement>(null)
  const editCancelButton = useRef<HTMLButtonElement>(null)
  const commentHeading = useRef<HTMLHeadingElement>(null)
  const deletedHeading = useRef<HTMLHeadingElement>(null)
  const dirty = editing && (draftTitle !== post?.title || draftBody !== post?.body)
  const canManage = viewerKnown && viewerType !== null
  useEffect(() => {
    if (!dirty) return
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty])
  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const link = (event.target as HTMLElement)?.closest?.('a')
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || link.target === '_blank') return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.href === window.location.href) return
      if (mutationLock.current || dirty) {
        event.preventDefault()
        if (!mutationLock.current) { returnFocus.current = link as HTMLElement; leaveHref.current = url.pathname + url.search + url.hash; setCancelTarget('leave') }
      }
    }
    document.addEventListener('click', intercept, true)
    return () => document.removeEventListener('click', intercept, true)
  }, [dirty])
  useEffect(() => { if (deleted) deletedHeading.current?.focus() }, [deleted])
  useEffect(() => {
    if (busy || cancelTarget !== null) return
    const target = pendingFocus.current
    if (!target) return
    const node = target === 'edit-button' ? editButton.current : editCancelButton.current
    if (!node || node.disabled) return
    pendingFocus.current = null
    node.focus()
  }, [busy, cancelTarget, editing])
  useEffect(() => {
    if (cancelTarget === null) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setCancelTarget(null)
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [cancelTarget])

  // 403을 받았을 때 "로그인하면 보인다"인지 "역할이 달라서 못 본다"인지 갈라야 해서
  // 보는 사람이 누구인지 먼저 확인한다. 목록 화면과 같은 경로를 쓴다.
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setViewerType(d?.user?.userType ?? null))
      .catch(() => setViewerType(null))
      .finally(() => setViewerKnown(true))
  }, [])

  const loadComments = useCallback(async (cursor?: string) => {
    if (terminal.current) return
    const version = generation.current
    setMoreLoading(true)
    setMoreFailed(false)
    try {
      const cRes = await fetch(`/api/community/posts/${id}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
      if (terminal.current || version !== generation.current) return
      if (!cRes.ok) {
        if (cursor) setMoreFailed(true)
        else setCommentsFailed(true)
        return
      }
      const data = await cRes.json()
      if (terminal.current || version !== generation.current) return
      data.comments = (data.comments ?? []).filter((c: Comment) => !removedComments.current.has(c.id))
      setComments(previous => cursor
        ? [...previous, ...(data.comments ?? []).filter((c: Comment) => !previous.some(p => p.id === c.id))]
        : data.comments ?? [])
      setCommentsTotal(data.total ?? data.comments?.length ?? 0)
      setCountFailed(false)
      setNextCursor(data.nextCursor ?? null)
      setCommentsFailed(false)
    } catch {
      if (terminal.current || version !== generation.current) return
      if (cursor) setMoreFailed(true)
      else setCommentsFailed(true)
    } finally {
      setMoreLoading(false)
    }
  }, [id])

  const load = useCallback(async () => {
    if (terminal.current) return
    const version = generation.current
    setLoading(true)
    try {
      const res = await fetch(`/api/community/posts/${id}`)
      if (terminal.current || version !== generation.current) return
      if (!res.ok) {
        // 이 API는 401을 반환하지 않는다. 읽기는 비로그인에도 열려 있고, 역할 판 글은
        // `posts/[id]/route.ts`에서 403이다. 예전의 401 분기는 한 번도 타지 않는
        // 사문화된 코드라 지웠다. 실제로 오는 403을 처리한다.
        setError({
          message: (await res.json().catch(() => null))?.error ?? '게시글을 불러오지 못했습니다',
          forbidden: res.status === 403,
          missing: res.status === 404,
        })
        return
      }
      setError(null)
      const data = await res.json()
      if (terminal.current || version !== generation.current) return
      setPost(data.post)
      await loadComments()
    } catch {
      if (!terminal.current && version === generation.current) setError({ message: '게시글을 불러오지 못했습니다', forbidden: false })
    } finally {
      setLoading(false)
    }
  }, [id, loadComments])

  useEffect(() => { load() }, [load])

  async function submitComment() {
    if (!body.trim() || mutationLock.current || terminal.current) return
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

  function beginDelete(target: string, trigger: HTMLElement) {
    if (mutationLock.current) return
    returnFocus.current = trigger
    setMutationError(''); setFailureStatus(null); setUncertain(false); setDeleteTarget(target)
  }
  function failure(status: number | null, deleting: boolean) {
    setFailureStatus(status)
    setUncertain(status === null)
    setMutationError(status === 401 ? '로그인이 만료됐습니다. 다시 로그인한 뒤 시도해주세요.'
      : status === 403 ? '지금 계정으로는 이 내용을 변경할 수 없습니다.'
      : status === 404 ? '이 내용은 더 이상 변경할 수 없습니다. 삭제되었거나 볼 수 없게 됐을 수 있습니다.'
      : status === 429 ? '잠시 후 다시 시도해주세요.'
      : status === null ? (deleting ? '삭제 결과를 확인하지 못했습니다.' : '저장 결과를 확인하지 못했습니다. 입력한 내용은 그대로 있습니다.')
      : deleting ? '삭제하지 못했습니다. 다시 시도해주세요.' : '글을 저장하지 못했습니다. 입력한 내용은 그대로 있습니다. 다시 시도해주세요.')
  }
  async function change(deleting: boolean) {
    if (mutationLock.current || submitting || reportSubmitting || terminal.current) return
    if (!deleting) {
      if (!draftTitle.trim()) { setMutationError('제목을 입력해주세요.'); return }
      if (!draftBody.trim()) { setMutationError('내용을 입력해주세요.'); return }
      if (draftTitle.trim().length > 200 || draftBody.trim().length > 10000) { setMutationError('제목은 200자, 내용은 10,000자 이내로 입력해주세요.'); return }
    }
    mutationLock.current = true; setBusy(true); setMutationError(''); setFailureStatus(null)
    generation.current += 1
    try {
      const target = deleteTarget
      const response = await fetch(`/api/community/posts/${id}${deleting && target !== 'post' ? `/comments/${target}` : ''}`, {
        method: deleting ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        ...(!deleting ? { body: JSON.stringify({ title: draftTitle, body: draftBody }) } : {}),
      })
      if (!response.ok) { failure(response.status, deleting); return }
      const data = await response.json()
      if (deleting && (data?.deleted !== true || data?.id !== (target === 'post' ? id : target))) {
        failure(null, true); return
      }
      if (!deleting) {
        if (!data.post) { failure(null, false); return }
        setPost(previous => previous ? { ...previous, ...data.post } : previous)
        pendingFocus.current = 'edit-button'
        setEditing(false); toast.success('글이 수정됐습니다.')
      } else if (target === 'post') {
        generation.current += 1; terminal.current = true; setDeleted(true); setDeleteTarget(null)
      } else if (target) {
        removedComments.current.add(target)
        setComments(previous => previous.filter(comment => comment.id !== target))
        generation.current += 1
        if (Number.isInteger(data.total)) { setCommentsTotal(data.total); setCommentsFailed(false); setCountFailed(false) }
        else { setCountFailed(true); void refreshCount() }
        setDeleteTarget(null); toast.success('댓글이 삭제됐습니다.')
        requestAnimationFrame(() => commentHeading.current?.focus())
      }
      setUncertain(false)
    } catch { failure(null, deleting) }
    finally { mutationLock.current = false; setBusy(false) }
  }
  async function refreshCount() {
    const version = generation.current
    try {
      const response = await fetch(`/api/community/posts/${id}/comments`)
      if (!response.ok) throw new Error('count')
      const data = await response.json()
      if (terminal.current || version !== generation.current) return
      if (!Number.isInteger(data.total)) throw new Error('count')
      setCommentsTotal(data.total); setCountFailed(false)
    } catch { if (!terminal.current && version === generation.current) setCountFailed(true) }
  }
  async function verifyResult() {
    if (mutationLock.current) return
    mutationLock.current = true; setBusy(true)
    generation.current += 1
    try {
      const response = await fetch(`/api/community/posts/${id}${deleteTarget && deleteTarget !== 'post' ? '/comments' : ''}`)
      if (!response.ok) { failure(response.status, !!deleteTarget); return }
      const data = await response.json()
      // 댓글 결과 확인은 모든 페이지를 읽어야 첫 페이지 밖의 댓글을 삭제로 오인하지 않는다.
      if (!data.post) {
        let cursor = data.nextCursor
        while (cursor) {
          const page = await fetch(`/api/community/posts/${id}/comments?cursor=${encodeURIComponent(cursor)}`)
          if (!page.ok) throw new Error('verify')
          const next = await page.json()
          data.comments.push(...next.comments)
          data.total = next.total
          cursor = next.nextCursor
        }
      }
      if (data.post) {
        setPost(data.post)
        if (editing && data.post.title === draftTitle.trim() && data.post.body === draftBody.trim()) setEditing(false)
      } else {
        if (deleteTarget && !data.comments.some((comment: Comment) => comment.id === deleteTarget)) removedComments.current.add(deleteTarget)
        setComments(previous => {
          const latest = new Map((data.comments as Comment[]).filter(c => !removedComments.current.has(c.id)).map(c => [c.id, c]))
          return [...previous.filter(c => c.id !== deleteTarget || latest.has(c.id)).map(c => latest.get(c.id) ?? c), ...[...latest.values()].filter(c => !previous.some(p => p.id === c.id))]
        })
        setCommentsTotal(data.total); setCommentsFailed(false); setCountFailed(false)
      }
      setUncertain(false); setFailureStatus(null)
      setMutationError('현재 내용을 확인했습니다. 입력한 내용은 보존했습니다.')
      setDeleteTarget(null)
    } catch { setMutationError('결과를 확인하지 못했습니다. 다시 확인해주세요.') }
    finally { mutationLock.current = false; setBusy(false) }
  }
  const recovery = <>
    {mutationError && <p role="alert" className="text-sm text-destructive">{mutationError}</p>}
    {failureStatus === 401 && <><p className="text-sm">입력한 내용을 복사해 보관해주세요. 로그인 화면으로 이동하면 내용이 사라질 수 있습니다.</p><Link href={`/login?redirect=${encodeURIComponent(`/community/${id}`)}`}>로그인하고 돌아오기</Link></>}
    {(uncertain || failureStatus === 403 || failureStatus === 404) && <Button type="button" variant="outline" disabled={busy} onClick={verifyResult}>{uncertain ? '결과 다시 확인' : '글 다시 확인'}</Button>}
  </>

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
        <Link href="/community" onClick={event => { if (busy || dirty) { event.preventDefault(); if (!busy) { returnFocus.current = event.currentTarget; leaveHref.current = '/community'; setCancelTarget('leave') } } }} className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← 커뮤니티</Link>

        {deleted ? (
          <Card className="p-6 text-center" aria-live="polite">
            <h1 ref={deletedHeading} tabIndex={-1} className="text-xl font-bold">글이 삭제됐습니다.</h1>
            <p className="my-3">이 글과 댓글은 더 이상 볼 수 없습니다.</p>
            <Button onClick={() => { router.push('/community'); router.refresh() }}>커뮤니티로 돌아가기</Button>
          </Card>
        ) : hiddenByReport ? (
          <Card className="p-6">
            <EmptyState
              icon={<ShieldAlert className="h-10 w-10" />}
              title="신고가 접수돼 이 글은 보이지 않게 됐습니다"
              description="운영자가 확인합니다. 결과는 따로 안내되지 않습니다."
              action={{ label: '커뮤니티로 돌아가기', onClick: () => router.push('/community') }}
            />
          </Card>
        ) : loading || (error?.forbidden && !viewerKnown) ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">{error.missing ? '글을 찾을 수 없습니다.' : error.message}</p>
            {error.missing && <><p>삭제되었거나 더 이상 볼 수 없는 글입니다.</p><Link href="/community">커뮤니티로 돌아가기</Link></>}
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
                  <Link href="/community" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
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
              {editing ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); change(false) }}>
                <h1 className="text-xl font-bold">글 수정</h1>
                <label className="block">제목<Input autoFocus value={draftTitle} maxLength={200} disabled={busy} onChange={event => setDraftTitle(event.target.value)} /></label>
                <label className="block">내용<Textarea value={draftBody} maxLength={10000} rows={8} disabled={busy} onChange={event => setDraftBody(event.target.value)} /></label>
                {recovery}
                <div className="flex gap-2"><Button ref={editCancelButton} type="button" variant="outline" disabled={busy} onClick={() => { if (dirty) { returnFocus.current = editCancelButton.current; setCancelTarget('edit') } else { pendingFocus.current = 'edit-button'; setEditing(false) } }}>취소</Button>
                  <Button disabled={busy || uncertain || !canManage || !post.is_author || [401,403,404].includes(failureStatus ?? 0)}>{busy ? '저장 중…' : '수정 저장'}</Button></div>
              </form> : <><h1 className="text-xl font-bold">{post.title}</h1>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{post.body}</p>
              {!editing && !deleteTarget && mutationError && <div>{recovery}</div>}
              {canManage && post.is_author && <div className="mt-5 flex gap-2 border-t pt-3">
                <Button ref={editButton} variant="outline" disabled={busy || submitting} onClick={() => { setDraftTitle(post.title); setDraftBody(post.body); setMutationError(''); setFailureStatus(null); setUncertain(false); setEditing(true) }}>수정</Button>
                <Button variant="destructive" disabled={busy || submitting} onClick={event => beginDelete('post', event.currentTarget)}>삭제</Button>
              </div>}</>}
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
              목록·상세 모두 숨김·삭제를 제외한 공개 댓글 수를 쓴다.
              여기서는 댓글 API의 total로 페이지에 표시되지 않은 댓글까지 포함한다.
              조회 실패는 "댓글 0"과 구분하기 위해 숫자 없이 표시한다.
            */}
            <h2 ref={commentHeading} tabIndex={-1} className="mb-3 text-sm font-semibold">
              {commentsFailed || countFailed ? '댓글' : `댓글 ${commentsTotal}`}
            </h2>
            {countFailed && <div role="status" className="mb-3"><p>댓글 수를 확인하지 못했습니다.</p><Button variant="outline" onClick={refreshCount}>다시 확인</Button></div>}
            {commentsFailed ? (
              <Card className="mb-5 flex flex-col items-center gap-2 p-5 text-center">
                <p className="text-sm text-muted-foreground">댓글을 불러오지 못했습니다.</p>
                <Button variant="outline" size="sm" onClick={() => loadComments()}>다시 시도</Button>
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
                      {canManage && c.is_author === true && <><span>내 댓글</span><Button size="sm" variant="ghost" aria-label="내 댓글 삭제" disabled={busy || submitting} onClick={event => beginDelete(c.id, event.currentTarget)}>삭제</Button></>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}

            {!commentsFailed && !countFailed && commentsTotal === 0 && <p className="mb-5 text-sm">아직 댓글이 없습니다.</p>}
            {nextCursor && !commentsFailed && (
              <Button className="mb-5" variant="outline" disabled={busy || moreLoading}
                onClick={() => loadComments(nextCursor)}>
                {moreLoading ? '불러오는 중…' : moreFailed ? '댓글 더 보기 다시 시도' : '댓글 더 보기'}
              </Button>
            )}
            <div className="space-y-2">
              <Textarea placeholder="댓글을 입력하세요" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
              <div className="flex justify-end">
                <Button onClick={submitComment} disabled={busy || submitting || !body.trim()}>
                  {submitting ? '등록 중…' : '댓글 등록'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
        <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open && !mutationLock.current) setDeleteTarget(null) }}>
          <AlertDialogContent onEscapeKeyDown={event => { if (mutationLock.current) event.preventDefault() }} onCloseAutoFocus={event => { event.preventDefault(); if (!terminal.current) returnFocus.current?.focus() }}>
            <AlertDialogTitle>{deleteTarget === 'post' ? '글을 삭제할까요?' : '댓글을 삭제할까요?'}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget === 'post' ? '삭제한 글은 다시 볼 수 없으며, 이 화면에서 되돌릴 수 없습니다. 이 글의 댓글도 함께 볼 수 없게 됩니다.' : '삭제한 댓글은 다시 볼 수 없으며, 이 화면에서 되돌릴 수 없습니다.'}</AlertDialogDescription>
            {busy && <p role="status">삭제 결과를 확인하고 있습니다.</p>}
            {recovery}
            <div className="flex justify-end gap-2"><AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
              <Button variant="destructive" disabled={busy || uncertain || [401,403,404].includes(failureStatus ?? 0)} onClick={() => change(true)}>{busy ? '삭제 중…' : deleteTarget === 'post' ? '글 삭제' : '댓글 삭제'}</Button></div>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={cancelTarget !== null} onOpenChange={open => { if (!open) setCancelTarget(null) }}>
          <AlertDialogContent onEscapeKeyDown={() => setCancelTarget(null)} onCloseAutoFocus={event => { event.preventDefault(); if (cancelDismissMode.current === 'discard') { cancelDismissMode.current = null; return } if (cancelTarget === 'edit') pendingFocus.current = 'edit-cancel'; else returnFocus.current?.focus() }}><AlertDialogTitle>수정을 취소할까요?</AlertDialogTitle><AlertDialogDescription>저장하지 않은 내용은 사라집니다.</AlertDialogDescription>
            <AlertDialogCancel>계속 수정</AlertDialogCancel><Button onClick={() => { const leave = cancelTarget === 'leave'; cancelDismissMode.current = 'discard'; setCancelTarget(null); if (leave) { router.push(leaveHref.current) } else { pendingFocus.current = 'edit-button'; setEditing(false) } }}>수정 취소</Button>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  )
}
