'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface DocItem {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  document_type: string
  file_name: string
  file_url: string | null
  status: string
  reject_reason: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  employment: '재직증명서',
  income: '소득증명서',
  credit: '신용정보서',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'processing' | 'approved' | 'rejected'>('pending')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const fetchDocs = useCallback(async (reset = false) => {
    setLoading(true)
    const params = new URLSearchParams({ status: statusFilter, limit: '30' })
    if (!reset && cursor) params.set('cursor', cursor)

    const res = await fetch(`/api/admin/documents?${params}`)
    const data = await res.json() as { documents: DocItem[]; nextCursor: string | null }
    setDocs(prev => reset ? data.documents : [...prev, ...data.documents])
    setCursor(data.nextCursor)
    setHasMore(!!data.nextCursor)
    setLoading(false)
  }, [statusFilter, cursor])

  useEffect(() => {
    setCursor(null)
    fetchDocs(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  useEffect(() => {
    observerRef.current?.disconnect()
    if (!sentinelRef.current || !hasMore) return
    observerRef.current = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchDocs() },
      { threshold: 0.1 }
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, fetchDocs])

  async function handleAction(docId: string, action: 'approve' | 'reject' | 'processing') {
    if (action === 'reject' && !rejectReason.trim()) {
      alert('거절 사유를 입력해주세요')
      return
    }
    const res = await fetch(`/api/admin/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reject_reason: rejectReason }),
    })
    if (res.ok) {
      setDocs(prev => prev.filter(d => d.id !== docId))
      setReviewing(null)
      setRejectReason('')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">서류 심사</h1>

      {/* Status tabs */}
      <div className="flex gap-2 mb-5">
        {(['pending', 'processing', 'approved', 'rejected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'pending' ? '대기' : s === 'processing' ? '처리중' : s === 'approved' ? '승인' : '거절'}
          </button>
        ))}
      </div>

      {/* Docs list */}
      <div className="space-y-3">
        {docs.map(d => (
          <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {d.user_name ?? d.user_email}
                  <span className="ml-2 text-xs text-gray-400">{d.user_email}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {TYPE_LABEL[d.document_type] ?? d.document_type} — {d.file_name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(d.created_at).toLocaleString('ko-KR')}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[d.status] ?? ''}`}>
                {d.status}
              </span>
            </div>

            {d.file_url && (
              <a
                href={d.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline mt-2 inline-block"
              >
                파일 보기 →
              </a>
            )}

            {/* Action buttons (pending/processing only) */}
            {(d.status === 'pending' || d.status === 'processing') && (
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => handleAction(d.id, 'processing')}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  처리중 전환
                </button>
                <button
                  onClick={() => handleAction(d.id, 'approve')}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  승인
                </button>
                {reviewing === d.id ? (
                  <>
                    <input
                      type="text"
                      placeholder="거절 사유 입력"
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs w-48"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAction(d.id, 'reject')}
                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      거절 확정
                    </button>
                    <button
                      onClick={() => { setReviewing(null); setRejectReason('') }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setReviewing(d.id)}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                  >
                    거절
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {!loading && docs.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
            해당 상태의 서류가 없습니다
          </div>
        )}
        {loading && (
          <div className="py-6 text-center text-sm text-gray-400">불러오는 중...</div>
        )}
        <div ref={sentinelRef} className="h-1" />
      </div>
    </div>
  )
}
