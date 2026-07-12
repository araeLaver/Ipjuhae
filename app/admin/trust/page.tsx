'use client'

import { useCallback, useEffect, useState } from 'react'

interface ReviewTask { id: string; reason: string; review_type: string; status: string; proposed_value: unknown; created_at: string }
interface ExtractionJob { id: string; email: string; name: string | null; document_type: string; status: string; attempt: number; created_at: string }
interface Source { code: string; name: string; source_type: string; reliability: number | string; privacy_risk: number | string; status: string }

export default function AdminTrustPage() {
  const [reviews, setReviews] = useState<ReviewTask[]>([])
  const [jobs, setJobs] = useState<ExtractionJob[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [reviewResponse, extractionResponse, sourceResponse] = await Promise.all([
      fetch('/api/v1/admin/trust-reviews?status=pending'),
      fetch('/api/v1/admin/trust-extractions?status=review_required'),
      fetch('/api/v1/admin/trust-sources'),
    ])
    const [reviewData, extractionData, sourceData] = await Promise.all([reviewResponse.json(), extractionResponse.json(), sourceResponse.json()])
    setReviews(reviewData.tasks ?? [])
    setJobs(extractionData.jobs ?? [])
    setSources(sourceData.sources ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function decide(task: ReviewTask, decision: 'accepted' | 'rejected') {
    const reason = window.prompt('결정 사유를 입력하세요')?.trim()
    if (!reason) return
    let correctedValue = task.proposed_value
    if (decision === 'accepted') {
      const raw = window.prompt('확정 값을 JSON으로 입력하세요', JSON.stringify(task.proposed_value))
      if (!raw) return
      try { correctedValue = JSON.parse(raw) } catch { window.alert('유효한 JSON이 아닙니다'); return }
    }
    const response = await fetch('/api/v1/admin/trust-reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ taskId: task.id, decision, decisionReason: reason, correctedValue }),
    })
    if (!response.ok) { const data = await response.json(); window.alert(data.error ?? '처리에 실패했습니다'); return }
    await load()
  }

  return (
    <div className="space-y-8">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Evidence operations</p><h1 className="mt-1 text-3xl font-bold text-gray-950">Trust Engine</h1><p className="mt-2 text-sm text-gray-500">검증 근거, 정정 심사, 추출 대기열과 출처 정책을 운영합니다.</p></div>
      <div className="grid grid-cols-3 gap-4">
        <Metric label="정정 대기" value={reviews.length} color="bg-amber-50 text-amber-800" />
        <Metric label="추출 검수" value={jobs.length} color="bg-sky-50 text-sky-800" />
        <Metric label="활성 출처" value={sources.filter((source) => source.status === 'active').length} color="bg-emerald-50 text-emerald-800" />
      </div>
      <Section title="정정·이의제기 대기열">
        {reviews.map((task) => <div key={task.id} className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4"><div><p className="font-medium text-gray-900">{task.reason}</p><p className="mt-1 text-xs text-gray-400">{task.review_type} · {new Date(task.created_at).toLocaleString()}</p></div><div className="flex gap-2"><button onClick={() => void decide(task, 'accepted')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">정정 승인</button><button onClick={() => void decide(task, 'rejected')} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">기각</button></div></div>)}
        {!loading && reviews.length === 0 ? <Empty /> : null}
      </Section>
      <Section title="문서 추출 검수 대기열">
        {jobs.map((job) => <div key={job.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-4"><div><p className="font-medium text-gray-900">{job.name ?? job.email}</p><p className="mt-1 text-xs text-gray-400">{job.document_type} · 시도 {job.attempt}회</p></div><a href="/admin/documents" className="text-xs font-semibold text-blue-600">서류 심사로 이동</a></div>)}
        {!loading && jobs.length === 0 ? <Empty /> : null}
      </Section>
      <Section title="검증 출처 레지스트리">
        <div className="overflow-hidden rounded-xl border border-gray-200"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">출처</th><th className="px-4 py-3">유형</th><th className="px-4 py-3">신뢰도</th><th className="px-4 py-3">개인정보 위험</th><th className="px-4 py-3">상태</th></tr></thead><tbody>{sources.map((source) => <tr key={source.code} className="border-t border-gray-100"><td className="px-4 py-3"><p className="font-medium text-gray-900">{source.name}</p><p className="text-xs text-gray-400">{source.code}</p></td><td className="px-4 py-3">{source.source_type}</td><td className="px-4 py-3">{Math.round(Number(source.reliability) * 100)}%</td><td className="px-4 py-3">{Math.round(Number(source.privacy_risk) * 100)}%</td><td className="px-4 py-3">{source.status}</td></tr>)}</tbody></table></div>
      </Section>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) { return <div className={`rounded-2xl p-5 ${color}`}><p className="text-sm font-medium opacity-70">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div> }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-gray-200 bg-white p-6"><h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2><div className="space-y-3">{children}</div></section> }
function Empty() { return <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">대기 항목이 없습니다.</div> }

