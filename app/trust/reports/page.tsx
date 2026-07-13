'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'

interface ReportRow {
  id: string
  title: string
  contract_address: string | null
  requester_role: string
  status: string
  verified_count: number
  attention_count: number
  item_count: number
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  draft: '작성 중',
  in_review: '검수 중',
  ready: '발급 가능',
  shared: '공유 중',
  revoked: '회수됨',
  expired: '만료됨',
}

export default function ContractReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [address, setAddress] = useState('')
  const [role, setRole] = useState<'tenant' | 'landlord' | 'broker'>('tenant')

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch('/api/v1/contract-reports', { cache: 'no-store' })
    const payload = await response.json()
    if (response.ok) setReports(payload.reports ?? [])
    else setError(payload.message ?? '리포트를 불러오지 못했습니다.')
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const response = await fetch('/api/v1/contract-reports', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        title,
        contractAddress: address || null,
        requesterRole: role,
        contractStage: 'pre_contract',
      }),
    })
    const payload = await response.json()
    if (response.ok) {
      setTitle('')
      setAddress('')
      await load()
    } else {
      setError(payload.message ?? payload.code ?? '리포트를 생성하지 못했습니다.')
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff1d8,_transparent_38%),linear-gradient(135deg,#f8f5ed,#edf4ee)] px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-stone-300 pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-700">Pre-contract evidence desk</p>
            <h1 className="mt-3 font-serif text-4xl font-semibold md:text-5xl">계약 전 확인 리포트</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              점수로 계약을 단정하지 않습니다. 확인된 자료, 미확인 사유, 기준일과 다음 행동을 임차인·임대인·주택별로 정리합니다.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/trust-center" className="rounded-full border border-stone-400 px-4 py-2 hover:bg-white">신뢰센터</Link>
            <Link href="/trust/cards" className="rounded-full bg-emerald-800 px-4 py-2 text-white hover:bg-emerald-900">Trust Card</Link>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <form onSubmit={create} className="h-fit rounded-3xl border border-orange-200 bg-[#fffaf0] p-6 shadow-[0_20px_60px_-35px_rgba(120,63,25,0.5)]">
            <h2 className="font-serif text-2xl">새 확인 건</h2>
            <p className="mt-2 text-xs leading-5 text-stone-500">초기 상태는 모두 미확인입니다. 운영자 대조가 끝난 항목만 확인됨으로 전환됩니다.</p>
            <label className="mt-6 block text-xs font-bold text-stone-600">리포트 제목</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} placeholder="성남시 분당구 계약 전 확인" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500" />
            <label className="mt-4 block text-xs font-bold text-stone-600">계약 대상 주소</label>
            <input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} placeholder="민감정보를 제외한 목적물 주소" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-orange-500" />
            <label className="mt-4 block text-xs font-bold text-stone-600">요청 역할</label>
            <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3">
              <option value="tenant">임차인</option>
              <option value="landlord">임대인</option>
              <option value="broker">공인중개사</option>
            </select>
            <button disabled={submitting} className="mt-6 w-full rounded-xl bg-orange-700 px-4 py-3 font-bold text-white hover:bg-orange-800 disabled:opacity-50">
              {submitting ? '생성 중...' : '15개 확인항목으로 시작'}
            </button>
            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          </form>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-2xl">진행 중인 리포트</h2>
              <span className="text-xs text-stone-500">총 {reports.length}건</span>
            </div>
            {loading ? <div className="rounded-2xl border border-stone-200 bg-white/80 p-8 text-stone-500">불러오는 중...</div> : null}
            {!loading && reports.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-400 bg-white/60 p-10 text-center text-stone-500">아직 생성된 리포트가 없습니다.</div> : null}
            <div className="space-y-4">
              {reports.map((report) => (
                <Link key={report.id} href={'/trust/reports/' + report.id} className="group block rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-400 hover:shadow-lg">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-bold text-stone-600">{STATUS_LABEL[report.status] ?? report.status}</span>
                      <h3 className="mt-3 text-lg font-bold group-hover:text-orange-800">{report.title}</h3>
                      <p className="mt-1 text-sm text-stone-500">{report.contract_address || '주소 미입력'} · {report.requester_role}</p>
                    </div>
                    <time className="text-xs text-stone-400">{new Date(report.created_at).toLocaleDateString('ko-KR')}</time>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                    <Metric label="전체" value={report.item_count} tone="stone" />
                    <Metric label="확인됨" value={report.verified_count} tone="green" />
                    <Metric label="확인 필요" value={report.attention_count} tone="orange" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'stone' | 'green' | 'orange' }) {
  const style = tone === 'green' ? 'bg-emerald-50 text-emerald-800' : tone === 'orange' ? 'bg-orange-50 text-orange-800' : 'bg-stone-100 text-stone-700'
  return <div className={'rounded-xl px-3 py-2 ' + style}><strong className="block text-lg">{value ?? 0}</strong>{label}</div>
}

