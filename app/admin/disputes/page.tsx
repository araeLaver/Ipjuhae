'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/page-container'

interface AdminDispute {
  id: string
  reason: string
  detail: string
  status: 'pending' | 'reviewing' | 'accepted' | 'rejected' | 'corrected' | 'withheld' | 'completed' | 'deleted'
  reference_response_id: string
  landlord_reference_id: string
  landlord_name: string | null
  tenant_name: string | null
  tenant_user_id: string | null
  requester_user_id: string | null
  requester_email: string | null
  reviewed_by: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  review_comment: string | null
  created_at: string
  updated_at: string
}

interface ListResponse {
  disputes: AdminDispute[]
  pendingCount: number
  pagination: {
    limit: number
    offset: number
    total: number
    hasMore: boolean
  }
}

type StatusFilter = 'all' | AdminDispute['status']
type UpdateStatus = AdminDispute['status']

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'reviewing', label: '검토 중' },
  { value: 'accepted', label: '수용' },
  { value: 'rejected', label: '반려' },
  { value: 'corrected', label: '정정' },
  { value: 'withheld', label: '보류' },
  { value: 'completed', label: '완료' },
  { value: 'deleted', label: '삭제' },
]

const STATUS_LABELS: Record<AdminDispute['status'], string> = {
  pending: '대기',
  reviewing: '검토 중',
  accepted: '수용',
  rejected: '반려',
  corrected: '정정',
  withheld: '보류',
  completed: '완료',
  deleted: '삭제',
}

const STATUS_TRANSITIONS: Record<AdminDispute['status'], UpdateStatus[]> = {
  pending: ['reviewing', 'accepted', 'rejected', 'corrected', 'withheld', 'completed', 'deleted'],
  reviewing: ['accepted', 'rejected', 'corrected', 'withheld', 'completed', 'deleted'],
  accepted: ['completed'],
  rejected: ['reviewing', 'completed'],
  corrected: ['completed'],
  withheld: ['completed'],
  completed: [],
  deleted: [],
}

export default function AdminDisputesPage() {
  const router = useRouter()
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [limit, setLimit] = useState(30)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const allowedActions = useMemo(
    () =>
      disputes.reduce(
        (map, dispute) => ({
          ...map,
          [dispute.id]: STATUS_TRANSITIONS[dispute.status] ?? [],
        }),
        {} as Record<string, UpdateStatus[]>
      ),
    [disputes]
  )

  const loadDisputes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('status', status)
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      const response = await fetch(`/api/admin/disputes?${params.toString()}`)
      const payload = (await response.json()) as ListResponse | { error?: string }

      if (!response.ok) {
        const apiError = (payload as { error?: string }).error || '이의 제기 목록을 불러오지 못했습니다.'
        if (response.status === 403) {
          router.push('/admin')
        }
        throw new Error(apiError)
      }

      const list = payload as ListResponse
      setDisputes(list.disputes)
      setHasMore(list.pagination.hasMore)
      setError('')
    } catch (err) {
      setError((err as Error).message)
      setDisputes([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDisputes()
  }, [status, limit, offset])

  const onUpdateStatus = async (dispute: AdminDispute, nextStatus: UpdateStatus) => {
    const comment = window.prompt('검토 의견 (선택). 필요 없으면 비워두세요.', dispute.review_comment ?? '')
    if (comment === null) {
      return
    }

    if (!allowedActions[dispute.id]?.includes(nextStatus)) {
      alert(`잘못된 상태 전환입니다: ${dispute.status} -> ${nextStatus}`)
      return
    }

    setUpdating(dispute.id)

    try {
      const response = await fetch('/api/admin/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: dispute.id,
          status: nextStatus,
          reviewComment: comment || undefined,
        }),
      })
      const payload = (await response.json()) as { dispute?: AdminDispute; error?: string }

      if (!response.ok) {
        throw new Error(payload.error || '상태 변경에 실패했습니다')
      }

      setDisputes((prev) =>
        prev.map((item) => (item.id === dispute.id ? { ...(payload.dispute as AdminDispute) } : item))
      )
    } catch (error) {
      alert((error as Error).message)
    } finally {
      setUpdating(null)
    }
  }

  if (loading && disputes.length === 0) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">추천서 이의 제기</h1>
          <p className="text-muted-foreground">불러오는 중...</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">이의 제기 관리</h1>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-muted-foreground">상태</label>
          <select
            value={status}
            onChange={(e) => {
              setOffset(0)
              setStatus(e.target.value as StatusFilter)
            }}
            className="w-44 border border-input bg-background rounded-md px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => {
              setOffset(0)
              setLimit(Number(e.target.value))
            }}
            className="w-32 border border-input bg-background rounded-md px-3 py-2 text-sm"
          >
            {[20, 30, 50].map((value) => (
              <option key={value} value={value}>
                {value}건 / 페이지
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setOffset(0)
              loadDisputes()
            }}
            className="px-4 py-2 text-sm rounded-md border bg-muted/50 hover:bg-muted"
          >
            검색
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2">등록일</th>
                <th className="px-3 py-2">요청자</th>
                <th className="px-3 py-2">추천서</th>
                <th className="px-3 py-2">사유</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {disputes.map((dispute) => {
                const actions = allowedActions[dispute.id] ?? []

                return (
                  <tr key={dispute.id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(dispute.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {dispute.requester_email ?? dispute.requester_user_id ?? '-'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div>{dispute.tenant_name ?? '세입자'}</div>
                      <div className="text-xs text-muted-foreground">
                        {dispute.landlord_name
                          ? `${dispute.landlord_name} (추천서)`
                          : `추천서 ID: ${dispute.landlord_reference_id}`}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="font-medium">{dispute.reason}</div>
                      <div className="text-xs text-muted-foreground max-w-xs break-words">{dispute.detail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex text-xs rounded-md px-2 py-1 bg-muted text-slate-700">
                        {STATUS_LABELS[dispute.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {actions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {actions.map((next) => (
                            <button
                              key={next}
                              disabled={updating === dispute.id}
                              onClick={() => onUpdateStatus(dispute, next)}
                              className="px-2 py-1 text-[11px] rounded-md border hover:bg-muted/50 disabled:opacity-40"
                            >
                              {STATUS_LABELS[next]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">추가 작업 없음</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {!loading && disputes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    이의 제기가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
            disabled={offset === 0 || loading}
            className="px-4 py-2 border rounded-md text-sm disabled:opacity-40"
          >
            이전
          </button>
          <button
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={!hasMore || loading}
            className="px-4 py-2 border rounded-md text-sm disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
