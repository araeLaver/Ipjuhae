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
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'withheld', label: 'Withheld' },
  { value: 'completed', label: 'Completed' },
  { value: 'deleted', label: 'Deleted' },
]

const STATUS_LABELS: Record<AdminDispute['status'], string> = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  accepted: 'Accepted',
  rejected: 'Rejected',
  corrected: 'Corrected',
  withheld: 'Withheld',
  completed: 'Completed',
  deleted: 'Deleted',
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
        const apiError = (payload as { error?: string }).error || 'Failed to load disputes.'
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
    const comment = window.prompt('Review comment (optional). Leave empty if not needed.', dispute.review_comment ?? '')
    if (comment === null) {
      return
    }

    if (!allowedActions[dispute.id]?.includes(nextStatus)) {
      alert(`Invalid transition: ${dispute.status} -> ${nextStatus}`)
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
        throw new Error(payload.error || 'Failed to update status')
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
          <h1 className="text-2xl font-bold">Reference disputes</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Dispute Management</h1>

        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-sm text-muted-foreground">Status</label>
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
                {value} / page
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setOffset(0)
              loadDisputes()
            }}
            className="px-4 py-2 text-sm rounded-md border bg-gray-50 hover:bg-gray-100"
          >
            Search
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Requester</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
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
                      <div>{dispute.tenant_name ?? 'Tenant'}</div>
                      <div className="text-xs text-muted-foreground">
                        {dispute.landlord_name
                          ? `${dispute.landlord_name} (Reference)`
                          : `Reference ID: ${dispute.landlord_reference_id}`}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="font-medium">{dispute.reason}</div>
                      <div className="text-xs text-muted-foreground max-w-xs break-words">{dispute.detail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex text-xs rounded-md px-2 py-1 bg-slate-100 text-slate-700">
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
                              className="px-2 py-1 text-[11px] rounded-md border hover:bg-slate-50 disabled:opacity-40"
                            >
                              {next}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No further action</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {!loading && disputes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No disputes found.
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
            Prev
          </button>
          <button
            onClick={() => setOffset((prev) => prev + limit)}
            disabled={!hasMore || loading}
            className="px-4 py-2 border rounded-md text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
