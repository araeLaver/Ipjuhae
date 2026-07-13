'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface ReportItem {
  id: string
  subject_type: 'tenant' | 'landlord' | 'property' | 'broker'
  item_key: string
  label: string
  verification_status: 'VERIFIED' | 'REVIEW_REQUIRED' | 'MISSING' | 'EXPIRED' | 'REJECTED'
  source_type: string | null
  source_name: string | null
  source_ref: string | null
  source_observed_at: string | null
  valid_until: string | null
  public_value: unknown
  missing_reason: string | null
  next_action: string | null
  review_state: 'pending' | 'approved' | 'rejected'
  notes: string | null
}

interface Report {
  id: string
  title: string
  contract_address: string | null
  status: string
  requester_role: string
  generated_at: string | null
  expires_at: string | null
  items: ReportItem[]
  disclaimer: string
  can_review: boolean
}

const GROUPS = [
  { key: 'tenant', label: '임차인 확인' },
  { key: 'landlord', label: '임대인 확인' },
  { key: 'property', label: '주택 확인' },
  { key: 'broker', label: '중개 설명 기록' },
] as const

const STATUS_STYLE: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-900',
  REVIEW_REQUIRED: 'bg-amber-100 text-amber-900',
  MISSING: 'bg-stone-200 text-stone-700',
  EXPIRED: 'bg-orange-100 text-orange-900',
  REJECTED: 'bg-red-100 text-red-900',
}

export default function ContractReportDetailPage() {
  const params = useParams<{ id: string }>()
  const [report, setReport] = useState<Report | null>(null)
  const [items, setItems] = useState<ReportItem[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/v1/contract-reports/' + params.id, { cache: 'no-store' })
    const payload = await response.json()
    if (response.ok) {
      setReport(payload.report)
      setItems(payload.report.items ?? [])
      setError('')
    } else {
      setError(payload.message ?? '리포트를 불러오지 못했습니다.')
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  const approvedKeys = useMemo(
    () => [...new Set(items.filter((item) => item.review_state === 'approved').map((item) => item.item_key))],
    [items]
  )

  function edit(id: string, patch: Partial<ReportItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  async function save(item: ReportItem) {
    setSaving(item.id)
    const response = await fetch('/api/v1/contract-reports/' + params.id + '/items/' + item.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        verificationStatus: item.verification_status,
        sourceType: item.source_type,
        sourceName: item.source_name,
        sourceRef: item.source_ref,
        sourceObservedAt: item.source_observed_at,
        validUntil: item.valid_until,
        publicValue: item.public_value,
        missingReason: item.missing_reason,
        nextAction: item.next_action,
        reviewState: item.review_state,
        notes: item.notes,
      }),
    })
    const payload = await response.json()
    if (!response.ok) setError(payload.message ?? payload.code ?? '항목을 저장하지 못했습니다.')
    else await load()
    setSaving(null)
  }

  async function transition(status: string) {
    const response = await fetch('/api/v1/contract-reports/' + params.id, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const payload = await response.json()
    if (!response.ok) setError(payload.message ?? payload.code ?? '상태를 변경하지 못했습니다.')
    else await load()
  }

  async function issueCard() {
    if (!report || approvedKeys.length === 0) return
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const response = await fetch('/api/v1/trust-cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({
        reportId: report.id,
        subjectType: 'combined',
        title: report.title + ' Trust Card',
        audienceRole: 'private_recipient',
        purpose: '임대차 계약 전 확인',
        fieldKeys: approvedKeys,
        expiresAt,
      }),
    })
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.message ?? payload.code ?? 'Trust Card를 발급하지 못했습니다.')
      return
    }
    setShareUrl(window.location.origin + '/trust/card/' + payload.share_token)
    await load()
  }

  if (!report) {
    return <main className="min-h-screen bg-stone-100 p-10"><div className="mx-auto max-w-4xl rounded-2xl bg-white p-8">{error || '리포트를 불러오는 중...'}</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f4f0e7] px-4 py-8 text-stone-900">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl bg-[#173f35] p-7 text-white shadow-xl md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">Evidence before decision</p>
              <h1 className="mt-3 font-serif text-3xl md:text-5xl">{report.title}</h1>
              <p className="mt-3 text-sm text-emerald-50">{report.contract_address || '계약 대상 주소 미입력'} · {report.requester_role} 요청</p>
            </div>
            <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold">{report.status}</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/trust/reports" className="rounded-full border border-white/30 px-4 py-2 text-sm">목록</Link>
            <button onClick={() => window.open('/api/v1/contract-reports/' + report.id + '/print', '_blank')} className="rounded-full bg-[#f0b35e] px-4 py-2 text-sm font-bold text-stone-900">PDF로 인쇄</button>
            {report.status === 'draft' ? <button onClick={() => void transition('in_review')} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-950">운영자 검수 요청</button> : null}
            {report.can_review && report.status === 'in_review' ? <button onClick={() => void transition('ready')} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-950">검수 완료</button> : null}
            {['ready', 'shared'].includes(report.status) && approvedKeys.length > 0 ? <button onClick={() => void issueCard()} className="rounded-full border border-emerald-200 px-4 py-2 text-sm">Trust Card 발급</button> : null}
          </div>
        </header>

        {error ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
        {shareUrl ? <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4"><strong className="text-emerald-900">이번에만 표시되는 공유주소</strong><input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm" /></div> : null}

        <section className="mt-7 grid gap-5 xl:grid-cols-2">
          {GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.subject_type === group.key)
            return (
              <article key={group.key} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-serif text-2xl">{group.label}</h2>
                  <span className="text-xs text-stone-500">{groupItems.filter((item) => item.verification_status === 'VERIFIED').length}/{groupItems.length} 확인</span>
                </div>
                <div className="space-y-4">
                  {groupItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-stone-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{item.label}</strong>
                        <span className={'rounded-full px-2.5 py-1 text-[11px] font-bold ' + STATUS_STYLE[item.verification_status]}>{item.verification_status}</span>
                      </div>
                      {!report.can_review ? (
                        <dl className="mt-4 grid gap-2 text-sm text-stone-600">
                          <Info label="공개값" value={display(item.public_value)} />
                          <Info label="출처" value={item.source_name} />
                          <Info label="기준일" value={item.source_observed_at ? new Date(item.source_observed_at).toLocaleString('ko-KR') : null} />
                          <Info label="미확인 사유" value={item.missing_reason} />
                          <Info label="다음 행동" value={item.next_action} />
                        </dl>
                      ) : (
                        <div className="mt-4 grid gap-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <select value={item.verification_status} onChange={(event) => edit(item.id, { verification_status: event.target.value as ReportItem['verification_status'] })} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                              <option value="VERIFIED">확인됨</option>
                              <option value="REVIEW_REQUIRED">추가 확인 필요</option>
                              <option value="MISSING">미제출</option>
                              <option value="EXPIRED">유효기간 경과</option>
                              <option value="REJECTED">반려</option>
                            </select>
                            <select value={item.review_state} onChange={(event) => edit(item.id, { review_state: event.target.value as ReportItem['review_state'] })} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                              <option value="pending">검수 대기</option>
                              <option value="approved">공개 승인</option>
                              <option value="rejected">공개 거절</option>
                            </select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input value={item.source_name ?? ''} onChange={(event) => edit(item.id, { source_name: event.target.value || null, source_type: 'manual_review' })} placeholder="출처·발급기관" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                            <input value={display(item.public_value)} onChange={(event) => edit(item.id, { public_value: event.target.value })} placeholder="원문이 아닌 공개용 확인값" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                          </div>
                          <textarea value={item.missing_reason ?? ''} onChange={(event) => edit(item.id, { missing_reason: event.target.value || null })} placeholder="미확인 사유" className="min-h-16 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                          <textarea value={item.next_action ?? ''} onChange={(event) => edit(item.id, { next_action: event.target.value || null })} placeholder="다음 확인 행동" className="min-h-16 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                          <button onClick={() => void save(item)} disabled={saving === item.id} className="justify-self-end rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving === item.id ? '저장 중...' : '검수 저장'}</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </section>

        <aside className="mt-7 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <strong className="block">책임 제한과 사용상 주의</strong>
          {report.disclaimer}
        </aside>
      </div>
    </main>
  )
}

function display(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div className="grid grid-cols-[90px_1fr] gap-2"><dt className="font-bold text-stone-500">{label}</dt><dd>{value || '-'}</dd></div>
}

