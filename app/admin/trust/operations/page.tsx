'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, Archive, DatabaseZap, FileSearch, Plus, RefreshCcw, Scale, ShieldCheck, X } from 'lucide-react'

type Tab = 'overview' | 'reviews' | 'extractions' | 'sources'
interface ReviewTask { id: string; reason: string; review_type: string; status: string; proposed_value: unknown; created_at: string }
interface ExtractionJob { id: string; email: string; name: string | null; document_type: string; status: string; attempt: number; error_code: string | null; created_at: string }
interface Source { code: string; name: string; source_type: string; reliability: number | string; privacy_risk: number | string; status: string; automation_level: string }
interface Overview {
  counts: Record<string, string> | null
  outbox: Array<{ id: string; event_type: string; aggregate_type: string; attempts: number; last_error: string | null; created_at: string; published_at: string | null }>
  risks: Array<{ signal_type: string; signal_value: number | string; threshold: number | string; state: string | null; risk_score: number | string | null; created_at: string }>
  retention: Array<{ target_type: string; action: string; status: string; scheduled_at: string; exception_reason: string | null }>
}

const EMPTY_OVERVIEW: Overview = { counts: null, outbox: [], risks: [], retention: [] }

export default function TrustOperationsPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW)
  const [reviews, setReviews] = useState<ReviewTask[]>([])
  const [extractions, setExtractions] = useState<ExtractionJob[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<ReviewTask | null>(null)
  const [extractionTarget, setExtractionTarget] = useState<ExtractionJob | null>(null)
  const [sourceFormOpen, setSourceFormOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const extractionUrls = ['pending', 'review_required', 'failed'].map((status) => `/api/v1/admin/trust-extractions?status=${status}`)
      const responses = await Promise.all([
        fetch('/api/v1/admin/trust-overview'),
        fetch('/api/v1/admin/trust-reviews?status=pending'),
        fetch('/api/v1/admin/trust-sources'),
        ...extractionUrls.map((url) => fetch(url)),
      ])
      if (responses.some((response) => !response.ok)) throw new Error('운영 데이터를 불러오지 못했습니다.')
      const data = await Promise.all(responses.map((response) => response.json()))
      setOverview(data[0])
      setReviews(data[1].tasks ?? [])
      setSources(data[2].sources ?? [])
      const jobs = data.slice(3).flatMap((item) => item.jobs ?? []) as ExtractionJob[]
      setExtractions([...new Map(jobs.map((job) => [job.id, job])).values()])
    } catch (err) {
      setError(err instanceof Error ? err.message : '운영 데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  const counts = overview.counts ?? {}
  const failedEvents = useMemo(() => overview.outbox.filter((event) => event.last_error), [overview.outbox])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-[#102f2b] px-7 py-8 text-white shadow-xl shadow-emerald-950/10">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#d96b45]/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f2a080]">Trust control room</p><h1 className="mt-3 font-serif text-4xl font-black">신뢰 운영 관제</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/70">근거 검수부터 정정, 공모격리, 공개회수와 보관 조치까지 하나의 운영 흐름으로 관리합니다.</p></div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/20"><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />새로고침</button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-2">
        {([['overview', '관제 현황'], ['reviews', `정정 심사 ${reviews.length}`], ['extractions', `추출 검수 ${extractions.length}`], ['sources', `출처 정책 ${sources.length}`]] as Array<[Tab, string]>).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === value ? 'bg-[#102f2b] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>)}
      </nav>

      {tab === 'overview' ? <OverviewTab overview={overview} counts={counts} failedEvents={failedEvents.length} /> : null}
      {tab === 'reviews' ? <Queue title="정정·이의제기 심사" empty="대기 중인 정정 요청이 없습니다.">{reviews.map((task) => <QueueRow key={task.id} title={task.reason} detail={`${task.review_type} · ${formatDate(task.created_at)}`} badge={task.status} action="심사" onAction={() => setReviewTarget(task)} />)}</Queue> : null}
      {tab === 'extractions' ? <Queue title="문서 추출 검수" empty="검수할 추출 작업이 없습니다.">{extractions.map((job) => <QueueRow key={job.id} title={`${job.name ?? job.email} · ${job.document_type}`} detail={`${job.status} · 시도 ${job.attempt}회 · ${formatDate(job.created_at)}`} badge={job.error_code ?? job.status} action="필드 검수" onAction={() => setExtractionTarget(job)} />)}</Queue> : null}
      {tab === 'sources' ? <SourcesTab sources={sources} onCreate={() => setSourceFormOpen(true)} /> : null}

      {reviewTarget ? <ReviewDialog task={reviewTarget} onClose={() => setReviewTarget(null)} onSaved={async () => { setReviewTarget(null); await load() }} /> : null}
      {extractionTarget ? <ExtractionDialog job={extractionTarget} onClose={() => setExtractionTarget(null)} onSaved={async () => { setExtractionTarget(null); await load() }} /> : null}
      {sourceFormOpen ? <SourceDialog onClose={() => setSourceFormOpen(false)} onSaved={async () => { setSourceFormOpen(false); await load() }} /> : null}
    </div>
  )
}

function OverviewTab({ overview, counts, failedEvents }: { overview: Overview; counts: Record<string, string>; failedEvents: number }) {
  const cards = [
    { label: '정정 심사', value: counts.pending_reviews ?? '0', icon: Scale, tone: 'bg-amber-50 text-amber-800' },
    { label: '추출 작업', value: counts.active_extractions ?? '0', icon: FileSearch, tone: 'bg-sky-50 text-sky-800' },
    { label: 'Outbox 대기', value: counts.pending_outbox ?? '0', icon: Activity, tone: 'bg-indigo-50 text-indigo-800' },
    { label: '공모 격리', value: counts.quarantined_edges ?? '0', icon: AlertTriangle, tone: 'bg-rose-50 text-rose-800' },
    { label: '활성 공개', value: counts.active_disclosures ?? '0', icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-800' },
    { label: '보관 조치', value: counts.pending_retention ?? '0', icon: Archive, tone: 'bg-stone-100 text-stone-800' },
  ]
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(({ label, value, icon: Icon, tone }) => <div key={label} className={`rounded-2xl p-5 ${tone}`}><div className="flex items-center justify-between"><p className="text-sm font-semibold opacity-70">{label}</p><Icon className="h-5 w-5" /></div><p className="mt-3 text-3xl font-black">{value}</p></div>)}</div><div className="grid gap-6 xl:grid-cols-2"><Queue title={`최근 Outbox · 오류 ${failedEvents}`} empty="최근 이벤트가 없습니다.">{overview.outbox.slice(0, 8).map((event) => <QueueRow key={event.id} title={event.event_type} detail={`${event.aggregate_type} · 시도 ${event.attempts}회 · ${formatDate(event.created_at)}`} badge={event.published_at ? 'published' : event.last_error ? 'failed' : 'pending'} />)}</Queue><Queue title="최근 위험신호" empty="탐지된 위험신호가 없습니다.">{overview.risks.slice(0, 8).map((risk, index) => <QueueRow key={`${risk.signal_type}-${index}`} title={risk.signal_type} detail={`값 ${risk.signal_value} / 기준 ${risk.threshold} · ${formatDate(risk.created_at)}`} badge={risk.state ?? 'signal'} />)}</Queue></div></div>
}

function SourcesTab({ sources, onCreate }: { sources: Source[]; onCreate: () => void }) { return <Queue title="검증 출처 레지스트리" empty="등록된 출처가 없습니다." headerAction={<button onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-[#d96b45] px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />출처 등록</button>}>{sources.map((source) => <QueueRow key={source.code} title={`${source.name} · ${source.code}`} detail={`${source.source_type} · ${source.automation_level} · 신뢰 ${Math.round(Number(source.reliability) * 100)}% · 노출위험 ${Math.round(Number(source.privacy_risk) * 100)}%`} badge={source.status} />)}</Queue> }

function Queue({ title, empty, children, headerAction }: { title: string; empty: string; children: ReactNode; headerAction?: ReactNode }) { const items = Array.isArray(children) ? children : [children]; return <section className="rounded-3xl border border-gray-200 bg-white p-6"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="font-serif text-xl font-black text-gray-950">{title}</h2>{headerAction}</div><div className="space-y-3">{items.length && items.some(Boolean) ? children : <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">{empty}</div>}</div></section> }
function QueueRow({ title, detail, badge, action, onAction }: { title: string; detail: string; badge: string; action?: string; onAction?: () => void }) { return <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 sm:flex-row sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{title}</p><p className="mt-1 text-xs text-gray-500">{detail}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-gray-900 px-2.5 py-1 text-[10px] font-bold uppercase text-white">{badge}</span>{action && onAction ? <button onClick={onAction} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">{action}</button> : null}</div></div> }

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-5 backdrop-blur"><h2 className="font-serif text-2xl font-black">{title}</h2><button onClick={onClose} aria-label="닫기" className="rounded-full p-2 hover:bg-gray-100"><X className="h-5 w-5" /></button></div><div className="p-6">{children}</div></div></div> }

function ReviewDialog({ task, onClose, onSaved }: { task: ReviewTask; onClose: () => void; onSaved: () => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [value, setValue] = useState(JSON.stringify(task.proposed_value, null, 2))
  const [saving, setSaving] = useState(false)
  async function save(decision: 'accepted' | 'partially_accepted' | 'rejected') { if (reason.trim().length < 5) return; let correctedValue: unknown = task.proposed_value; try { correctedValue = JSON.parse(value) } catch { return }; setSaving(true); const response = await fetch('/api/v1/admin/trust-reviews', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ taskId: task.id, decision, decisionReason: reason, correctedValue }) }); setSaving(false); if (response.ok) await onSaved() }
  return <Dialog title="정정 요청 심사" onClose={onClose}><p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{task.reason}</p><Label text="확정 값 JSON"><textarea value={value} onChange={(event) => setValue(event.target.value)} rows={8} className="field font-mono text-xs" /></Label><Label text="결정 사유"><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="field" /></Label><div className="mt-5 flex flex-wrap justify-end gap-2"><Action disabled={saving} onClick={() => void save('rejected')} tone="secondary">기각</Action><Action disabled={saving} onClick={() => void save('partially_accepted')} tone="secondary">부분 채택</Action><Action disabled={saving} onClick={() => void save('accepted')}>정정 승인</Action></div></Dialog>
}

function ExtractionDialog({ job, onClose, onSaved }: { job: ExtractionJob; onClose: () => void; onSaved: () => Promise<void> }) {
  const example = [{ fieldName: 'employment_verified', rawValue: '확인', normalizedValue: true, confidence: 0.95, pageRef: '1', reasonCodes: ['HUMAN_REVIEWED'] }]
  const [fields, setFields] = useState(JSON.stringify(example, null, 2))
  const [saving, setSaving] = useState(false)
  async function save() { let parsed: unknown; try { parsed = JSON.parse(fields) } catch { return }; setSaving(true); const response = await fetch(`/api/v1/admin/trust-extractions/${job.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ fields: parsed }) }); setSaving(false); if (response.ok) await onSaved() }
  return <Dialog title="추출 필드 검수" onClose={onClose}><div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900"><p className="font-semibold">{job.name ?? job.email}</p><p className="mt-1 text-xs">{job.document_type} · {job.status}</p></div><Label text="검수 완료 필드 JSON"><textarea value={fields} onChange={(event) => setFields(event.target.value)} rows={14} className="field font-mono text-xs" /></Label><div className="mt-5 flex justify-end"><Action disabled={saving} onClick={() => void save()}>검수 완료</Action></div></Dialog>
}

function SourceDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ code: '', name: '', sourceType: 'partner_api', authority: '', reliability: '0.8', retentionDays: '30', automationLevel: 'assisted', privacyRisk: '0.3' })
  const [saving, setSaving] = useState(false)
  function update(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })) }
  async function save() { setSaving(true); const response = await fetch('/api/v1/admin/trust-sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: form.code, name: form.name, sourceType: form.sourceType, authority: form.authority || null, allowedFields: [], reliability: Number(form.reliability), legalBasis: null, retentionDays: Number(form.retentionDays), automationLevel: form.automationLevel, estimatedCost: 0, expectedLatencyMs: 0, privacyRisk: Number(form.privacyRisk), status: 'active' }) }); setSaving(false); if (response.ok) await onSaved() }
  return <Dialog title="검증 출처 등록" onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Label text="출처 코드"><input value={form.code} onChange={(event) => update('code', event.target.value)} className="field" /></Label><Label text="표시 이름"><input value={form.name} onChange={(event) => update('name', event.target.value)} className="field" /></Label><Label text="출처 유형"><select value={form.sourceType} onChange={(event) => update('sourceType', event.target.value)} className="field"><option value="partner_api">제휴 API</option><option value="public_record">공적 자료</option><option value="ocr">OCR</option><option value="manual_review">수기 검수</option></select></Label><Label text="제공기관"><input value={form.authority} onChange={(event) => update('authority', event.target.value)} className="field" /></Label><Label text="신뢰도 0~1"><input type="number" min="0" max="1" step="0.05" value={form.reliability} onChange={(event) => update('reliability', event.target.value)} className="field" /></Label><Label text="개인정보 위험 0~1"><input type="number" min="0" max="1" step="0.05" value={form.privacyRisk} onChange={(event) => update('privacyRisk', event.target.value)} className="field" /></Label><Label text="보관일"><input type="number" min="0" value={form.retentionDays} onChange={(event) => update('retentionDays', event.target.value)} className="field" /></Label><Label text="자동화 수준"><select value={form.automationLevel} onChange={(event) => update('automationLevel', event.target.value)} className="field"><option value="manual">수동</option><option value="assisted">보조</option><option value="automatic">자동</option></select></Label></div><div className="mt-6 flex justify-end"><Action disabled={saving || !form.code || !form.name} onClick={() => void save()}><DatabaseZap className="h-4 w-4" />등록</Action></div></Dialog>
}

function Label({ text, children }: { text: string; children: ReactNode }) { return <label className="mt-4 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500">{text}</span>{children}</label> }
function Action({ children, onClick, disabled, tone = 'primary' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'secondary' }) { return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 ${tone === 'primary' ? 'bg-[#102f2b] text-white' : 'border border-gray-300 bg-white text-gray-700'}`}>{children}</button> }
function formatDate(value: string) { return new Date(value).toLocaleString('ko-KR') }

