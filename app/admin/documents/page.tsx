'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type DocumentStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'all'
type DocumentTypeFilter = 'all' | 'employment' | 'income' | 'credit'

interface DocItem {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  document_type: string
  file_name: string
  file_url: string | null
  status: 'pending' | 'processing' | 'approved' | 'rejected'
  reject_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

interface Counts {
  pending: number
  processing: number
  approved: number
  rejected: number
}

interface DocumentResponse {
  documents: DocItem[]
  nextCursor: string | null
  counts: Counts
  error?: string
}

const EMPTY_COUNTS: Counts = {
  pending: 0,
  processing: 0,
  approved: 0,
  rejected: 0,
}

const TYPE_LABEL: Record<string, string> = {
  employment: '재직증명서',
  income: '소득증명서',
  credit: '신용정보서',
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  all: '전체',
  pending: '대기',
  processing: '처리중',
  approved: '승인',
  rejected: '거절',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const TYPE_OPTIONS: Array<{ value: DocumentTypeFilter; label: string }> = [
  { value: 'all', label: '전체 유형' },
  { value: 'employment', label: '재직증명서' },
  { value: 'income', label: '소득증명서' },
  { value: 'credit', label: '신용정보서' },
]

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS)
  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('pending')
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilter>('all')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const debouncedSearch = useDebounce(search, 300)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const selectedDoc = useMemo(
    () => docs.find((doc) => doc.id === selectedId) ?? docs[0] ?? null,
    [docs, selectedId]
  )

  const loadDocs = useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
      if (!reset && cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/admin/documents?${params}`)
      const data = await res.json() as DocumentResponse
      if (!res.ok) {
        throw new Error(data?.error || '서류를 불러오지 못했습니다')
      }

      setDocs((prev) => (reset ? data.documents : [...prev, ...data.documents]))
      setCounts(data.counts ?? EMPTY_COUNTS)
      setCursor(data.nextCursor)
      setHasMore(Boolean(data.nextCursor))
      if (reset) {
        setSelectedId(data.documents[0]?.id ?? null)
        setRejectReason('')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '서류를 불러오지 못했습니다'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, debouncedSearch, cursor])

  useEffect(() => {
    setCursor(null)
    loadDocs(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, debouncedSearch])

  useEffect(() => {
    observerRef.current?.disconnect()
    if (!sentinelRef.current || !hasMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          loadDocs()
        }
      },
      { threshold: 0.1 }
    )

    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadDocs, loading])

  useEffect(() => {
    if (!selectedDoc?.id) return
    setRejectReason('')
  }, [selectedDoc?.id])

  async function reviewDocument(docId: string, action: 'approve' | 'reject' | 'processing') {
    if (saving) return

    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('거절 사유를 입력해주세요')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reject_reason: rejectReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || '서류 심사 처리에 실패했습니다')
      }

      toast.success(action === 'approve' ? '승인 처리되었습니다' : action === 'reject' ? '거절 처리되었습니다' : '처리중으로 전환했습니다')
      setRejectReason('')
      setSelectedId(null)
      setCursor(null)
      await loadDocs(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : '서류 심사 처리에 실패했습니다'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const selectedStatus = selectedDoc?.status ?? 'pending'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">서류 심사</h1>
          <p className="mt-1 text-sm text-gray-500">
            업로드된 재직·소득·신용 서류를 확인하고 승인/반려를 바로 처리합니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {([
            ['pending', counts.pending],
            ['processing', counts.processing],
            ['approved', counts.approved],
            ['rejected', counts.rejected],
          ] as const).map(([key, value]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                statusFilter === key
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-xs font-medium text-gray-500">{STATUS_LABEL[key]}</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
            </button>
          ))}
        </div>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이메일, 이름, 파일명 검색"
            />
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as DocumentTypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="유형 선택" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(['pending', 'processing', 'approved', 'rejected', 'all'] as const).map((status) => (
              <Button
                key={status}
                type="button"
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {STATUS_LABEL[status]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3">
          {docs.map((doc) => {
            const isSelected = doc.id === selectedDoc?.id
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {doc.user_name ?? doc.user_email}
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {TYPE_LABEL[doc.document_type] ?? doc.document_type}
                      </Badge>
                      <Badge className={`text-[11px] ${STATUS_STYLE[doc.status] ?? ''}`}>
                        {STATUS_LABEL[doc.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">{doc.user_email}</p>
                    <p className="mt-1 truncate text-sm text-gray-500">{doc.file_name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>{new Date(doc.created_at).toLocaleString('ko-KR')}</span>
                      {doc.reviewed_at && <span>심사 {new Date(doc.reviewed_at).toLocaleString('ko-KR')}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-blue-600">상세</span>
                </div>
              </button>
            )
          })}

          {!loading && docs.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
              해당 조건의 서류가 없습니다
            </div>
          )}

          {loading && (
            <div className="py-6 text-center text-sm text-gray-400">불러오는 중...</div>
          )}

          <div ref={sentinelRef} className="h-1" />
        </div>

        <div className="lg:sticky lg:top-6">
          <Card className="border-gray-200">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">서류 상세</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">선택한 서류의 파일과 심사 정보를 확인합니다.</p>
                </div>
                {selectedDoc && (
                  <Badge className={STATUS_STYLE[selectedStatus] ?? ''}>
                    {STATUS_LABEL[selectedStatus]}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDoc ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                  왼쪽 목록에서 서류를 선택하세요
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-gray-900">
                      {selectedDoc.user_name ?? selectedDoc.user_email}
                    </p>
                    <p className="text-sm text-gray-500">{selectedDoc.user_email}</p>
                    <p className="text-sm text-gray-600">
                      {TYPE_LABEL[selectedDoc.document_type] ?? selectedDoc.document_type} · {selectedDoc.file_name}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>제출일 {new Date(selectedDoc.created_at).toLocaleString('ko-KR')}</span>
                      {selectedDoc.reviewed_at && (
                        <span>심사일 {new Date(selectedDoc.reviewed_at).toLocaleString('ko-KR')}</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (selectedDoc.file_url) {
                        window.open(selectedDoc.file_url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    disabled={!selectedDoc.file_url}
                  >
                    파일 열기
                  </Button>
                  <Link
                    href={`/admin/users/${selectedDoc.user_id}`}
                    className="flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    회원 상세로 이동
                  </Link>
                  </div>

                  {selectedDoc.reject_reason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-700">반려 사유</p>
                      <p className="mt-1 text-sm text-red-800">{selectedDoc.reject_reason}</p>
                    </div>
                  )}

                  {selectedDoc.status === 'pending' || selectedDoc.status === 'processing' ? (
                    <div className="space-y-3">
                      <Textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="거절 사유를 입력하세요"
                        className="min-h-[112px]"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => reviewDocument(selectedDoc.id, 'processing')}
                          disabled={saving}
                        >
                          처리중
                        </Button>
                        <Button
                          type="button"
                          onClick={() => reviewDocument(selectedDoc.id, 'approve')}
                          disabled={saving}
                        >
                          승인
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => reviewDocument(selectedDoc.id, 'reject')}
                          disabled={saving}
                        >
                          반려
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                      심사 완료된 서류입니다.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
