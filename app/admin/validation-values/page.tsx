'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Clock, FileCheck2, RefreshCw, Search, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type ReviewStatus = 'all' | 'extracted' | 'needs_review' | 'confirmed' | 'rejected' | 'corrected' | 'expired' | 'disputed'
type SourceType = 'all' | 'legacy' | 'ocr' | 'manual' | 'external_api' | 'reference' | 'system'
type SubjectType = 'all' | 'tenant' | 'landlord' | 'property' | 'reference'
type ReviewAction = 'confirm' | 'reject' | 'correct' | 'expire' | 'dispute'

interface ValidationValueItem {
  id: string
  owner_user_id: string
  owner_email: string
  owner_name: string | null
  subject_type: string
  subject_id: string | null
  validation_key: string
  validation_score: number | null
  validation_numeric: string | null
  validation_text: string | null
  validation_flag: string | null
  status: string
  source_type: string | null
  source_authority: string | null
  source_comment: string | null
  review_status: string | null
  reason_codes: string[] | null
  valid_until: string | null
  retention_until: string | null
  model_version: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  evidence_file_name: string | null
  evidence_document_type: string | null
  evidence_extraction_status: string | null
  created_at: string
  updated_at: string
}

interface ValidationValueResponse {
  validationValues: ValidationValueItem[]
  nextCursor: string | null
  counts: {
    extracted: number
    needsReview: number
    confirmed: number
    rejected: number
    corrected: number
    expired: number
    disputed: number
  }
  error?: string
}

const EMPTY_COUNTS: ValidationValueResponse['counts'] = {
  extracted: 0,
  needsReview: 0,
  confirmed: 0,
  rejected: 0,
  corrected: 0,
  expired: 0,
  disputed: 0,
}

const REVIEW_LABEL: Record<ReviewStatus, string> = {
  all: '전체',
  extracted: '추출',
  needs_review: '검수 대기',
  confirmed: '확인',
  rejected: '반려',
  corrected: '정정',
  expired: '만료',
  disputed: '분쟁',
}

const REVIEW_STYLE: Record<string, string> = {
  extracted: 'bg-sky-100 text-sky-700',
  needs_review: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  corrected: 'bg-indigo-100 text-indigo-700',
  expired: 'bg-gray-100 text-gray-700',
  disputed: 'bg-orange-100 text-orange-700',
}

const SOURCE_LABEL: Record<SourceType, string> = {
  all: '전체 출처',
  legacy: '기존값',
  ocr: 'OCR',
  manual: '수기',
  external_api: '외부 API',
  reference: '레퍼런스',
  system: '시스템',
}

const SUBJECT_LABEL: Record<SubjectType, string> = {
  all: '전체 대상',
  tenant: '임차인',
  landlord: '임대인',
  property: '주택',
  reference: '레퍼런스',
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
}

function formatValue(item: ValidationValueItem) {
  if (item.validation_text) return item.validation_text
  if (item.validation_numeric) return item.validation_numeric
  if (item.validation_flag) return item.validation_flag
  if (item.validation_score !== null && item.validation_score !== undefined) return String(item.validation_score)
  return '후보값 없음'
}

function reviewReason(action: ReviewAction) {
  const reasons: Record<ReviewAction, string[]> = {
    confirm: ['HUMAN_REVIEW_CONFIRMED'],
    reject: ['HUMAN_REVIEW_REJECTED'],
    correct: ['HUMAN_REVIEW_CORRECTED'],
    expire: ['VALUE_EXPIRED'],
    dispute: ['DISPUTE_OPENED'],
  }
  return reasons[action]
}

export default function AdminValidationValuesPage() {
  const [items, setItems] = useState<ValidationValueItem[]>([])
  const [counts, setCounts] = useState(EMPTY_COUNTS)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('needs_review')
  const [sourceType, setSourceType] = useState<SourceType>('all')
  const [subjectType, setSubjectType] = useState<SubjectType>('all')
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [textValue, setTextValue] = useState('')
  const [numericValue, setNumericValue] = useState('')
  const [scoreValue, setScoreValue] = useState('')
  const [flagValue, setFlagValue] = useState('')

  const debouncedSearch = useDebounce(search, 300)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  )

  const loadValues = useCallback(async (reset = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (reviewStatus !== 'all') params.set('reviewStatus', reviewStatus)
      if (sourceType !== 'all') params.set('sourceType', sourceType)
      if (subjectType !== 'all') params.set('subjectType', subjectType)
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
      if (!reset && cursor) params.set('cursor', cursor)

      const res = await fetch(`/api/admin/validation-values?${params}`)
      const data = await res.json() as ValidationValueResponse
      if (!res.ok) {
        throw new Error(data?.error || '검증값 후보를 불러오지 못했습니다')
      }

      setItems((prev) => (reset ? data.validationValues : [...prev, ...data.validationValues]))
      setCounts(data.counts ?? EMPTY_COUNTS)
      setCursor(data.nextCursor)
      setHasMore(Boolean(data.nextCursor))
      if (reset) {
        setSelectedId(data.validationValues[0]?.id ?? null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '검증값 후보를 불러오지 못했습니다'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [reviewStatus, sourceType, subjectType, debouncedSearch, cursor])

  useEffect(() => {
    setCursor(null)
    loadValues(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewStatus, sourceType, subjectType, debouncedSearch])

  useEffect(() => {
    observerRef.current?.disconnect()
    if (!sentinelRef.current || !hasMore) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          loadValues()
        }
      },
      { threshold: 0.1 },
    )

    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadValues, loading])

  useEffect(() => {
    if (!selectedItem) {
      setReviewComment('')
      setTextValue('')
      setNumericValue('')
      setScoreValue('')
      setFlagValue('')
      return
    }

    setReviewComment('')
    setTextValue(selectedItem.validation_text ?? '')
    setNumericValue(selectedItem.validation_numeric ?? '')
    setScoreValue(selectedItem.validation_score === null || selectedItem.validation_score === undefined ? '' : String(selectedItem.validation_score))
    setFlagValue(selectedItem.validation_flag ?? '')
  }, [selectedItem?.id, selectedItem])

  async function reviewValue(action: ReviewAction) {
    if (!selectedItem || saving) return

    if (action === 'reject' && !reviewComment.trim()) {
      toast.error('반려 사유를 입력해주세요')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/validation-values/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          validationText: textValue.trim() || null,
          validationNumeric: numericValue.trim() || null,
          validationScore: scoreValue.trim() ? Number(scoreValue) : null,
          validationFlag: flagValue.trim() || null,
          sourceComment: reviewComment.trim() || selectedItem.source_comment,
          reviewComment: reviewComment.trim(),
          reasonCodes: reviewReason(action),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data?.error || '검수 처리에 실패했습니다')
      }

      const messageMap: Record<ReviewAction, string> = {
        confirm: '확인 완료로 전환했습니다',
        reject: '반려 처리했습니다',
        correct: '정정 완료로 전환했습니다',
        expire: '만료 처리했습니다',
        dispute: '분쟁 상태로 전환했습니다',
      }
      toast.success(messageMap[action])
      setCursor(null)
      await loadValues(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : '검수 처리에 실패했습니다'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const statusCards = [
    { key: 'needs_review' as const, label: '검수 대기', value: counts.needsReview, icon: Clock },
    { key: 'confirmed' as const, label: '확인', value: counts.confirmed, icon: CheckCircle2 },
    { key: 'rejected' as const, label: '반려', value: counts.rejected, icon: XCircle },
    { key: 'disputed' as const, label: '분쟁', value: counts.disputed, icon: AlertTriangle },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">검증값 검수</h1>
            <p className="mt-1 text-sm text-gray-500">
              OCR·외부자료 후보값을 확인 항목으로 승인하거나 반려합니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCursor(null)
              loadValues(true)
            }}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {statusCards.map(({ key, label, value, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setReviewStatus(key)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                reviewStatus === key
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
            </button>
          ))}
        </div>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이메일, 이름, 검증키, 출처 검색"
                className="pl-9"
              />
            </div>
            <Select value={reviewStatus} onValueChange={(value) => setReviewStatus(value as ReviewStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="검수 상태" />
              </SelectTrigger>
              <SelectContent>
                {(['needs_review', 'extracted', 'confirmed', 'corrected', 'rejected', 'expired', 'disputed', 'all'] as const).map((status) => (
                  <SelectItem key={status} value={status}>
                    {REVIEW_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceType)}>
              <SelectTrigger>
                <SelectValue placeholder="출처" />
              </SelectTrigger>
              <SelectContent>
                {(['all', 'ocr', 'manual', 'external_api', 'reference', 'system', 'legacy'] as const).map((source) => (
                  <SelectItem key={source} value={source}>
                    {SOURCE_LABEL[source]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectType} onValueChange={(value) => setSubjectType(value as SubjectType)}>
              <SelectTrigger>
                <SelectValue placeholder="대상" />
              </SelectTrigger>
              <SelectContent>
                {(['all', 'tenant', 'landlord', 'property', 'reference'] as const).map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {SUBJECT_LABEL[subject]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
        <div className="space-y-3">
          {items.map((item) => {
            const isSelected = item.id === selectedItem?.id
            const currentReviewStatus = item.review_status ?? 'needs_review'
            return (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {item.owner_name ?? item.owner_email}
                      </span>
                      <Badge variant="outline" className="text-[11px]">
                        {SUBJECT_LABEL[item.subject_type as SubjectType] ?? item.subject_type}
                      </Badge>
                      <Badge className={`text-[11px] ${REVIEW_STYLE[currentReviewStatus] ?? ''}`}>
                        {REVIEW_LABEL[currentReviewStatus as ReviewStatus] ?? currentReviewStatus}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">{item.validation_key}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{formatValue(item)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>{SOURCE_LABEL[(item.source_type ?? 'legacy') as SourceType] ?? item.source_type}</span>
                      <span>{formatDate(item.created_at)}</span>
                      {item.evidence_file_name && <span>{item.evidence_file_name}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-blue-600">상세</span>
                </div>
              </button>
            )
          })}

          {!loading && items.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
              해당 조건의 검증값 후보가 없습니다
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
                  <CardTitle className="text-lg">검수 상세</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">후보값을 확인 항목으로 확정하거나 회수합니다.</p>
                </div>
                {selectedItem && (
                  <Badge className={REVIEW_STYLE[selectedItem.review_status ?? 'needs_review'] ?? ''}>
                    {REVIEW_LABEL[(selectedItem.review_status ?? 'needs_review') as ReviewStatus] ?? selectedItem.review_status}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedItem ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">
                  왼쪽 목록에서 검증값을 선택하세요
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-gray-900">
                      {selectedItem.owner_name ?? selectedItem.owner_email}
                    </p>
                    <p className="text-sm text-gray-500">{selectedItem.owner_email}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{selectedItem.validation_key}</span>
                      <span>{SOURCE_LABEL[(selectedItem.source_type ?? 'legacy') as SourceType] ?? selectedItem.source_type}</span>
                      <span>{formatDate(selectedItem.created_at)}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">현재 후보값</p>
                      <p className="mt-1 break-words text-gray-900">{formatValue(selectedItem)}</p>
                    </div>
                    {selectedItem.source_authority && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500">출처</p>
                        <p className="mt-1 text-gray-700">{selectedItem.source_authority}</p>
                      </div>
                    )}
                    {selectedItem.reason_codes && selectedItem.reason_codes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500">사유코드</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selectedItem.reason_codes.map((code) => (
                            <Badge key={code} variant="outline" className="bg-white text-[10px]">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedItem.evidence_file_name && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                        <FileCheck2 className="h-4 w-4" />
                        {selectedItem.evidence_file_name}
                      </div>
                      <p className="mt-1 text-xs text-blue-700">
                        {selectedItem.evidence_document_type ?? 'document'} · {selectedItem.evidence_extraction_status ?? 'unknown'}
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3">
                    <Input
                      value={textValue}
                      onChange={(event) => setTextValue(event.target.value)}
                      placeholder="텍스트 값"
                    />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        value={numericValue}
                        onChange={(event) => setNumericValue(event.target.value)}
                        placeholder="숫자 값"
                        inputMode="decimal"
                      />
                      <Input
                        value={scoreValue}
                        onChange={(event) => setScoreValue(event.target.value)}
                        placeholder="점수"
                        inputMode="numeric"
                      />
                      <Input
                        value={flagValue}
                        onChange={(event) => setFlagValue(event.target.value)}
                        placeholder="상태 플래그"
                      />
                    </div>
                    <Textarea
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="검수 의견 또는 반려 사유"
                      className="min-h-[104px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" onClick={() => reviewValue('confirm')} disabled={saving}>
                      확인
                    </Button>
                    <Button type="button" variant="outline" onClick={() => reviewValue('correct')} disabled={saving}>
                      정정
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => reviewValue('reject')} disabled={saving}>
                      반려
                    </Button>
                    <Button type="button" variant="outline" onClick={() => reviewValue('dispute')} disabled={saving}>
                      분쟁
                    </Button>
                    <Button type="button" variant="outline" onClick={() => reviewValue('expire')} disabled={saving} className="col-span-2">
                      만료 처리
                    </Button>
                  </div>

                  <Link
                    href={`/admin/users/${selectedItem.owner_user_id}`}
                    className="flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    회원 상세로 이동
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
