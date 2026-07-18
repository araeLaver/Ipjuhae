'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'

interface Overview {
  reports: Array<Record<string, unknown>>
  intakes: Array<Record<string, unknown>>
  ai_runs: Array<Record<string, unknown>>
  experiments: Array<Record<string, unknown>>
  gates: Array<Record<string, unknown>>
  organizations: Array<Record<string, unknown>>
}

type GateStatus = 'pending' | 'approved' | 'blocked'

const EMPTY: Overview = { reports: [], intakes: [], ai_runs: [], experiments: [], gates: [], organizations: [] }

export default function TrustProductAdminPage() {
  const [data, setData] = useState<Overview>(EMPTY)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [segment, setSegment] = useState('임차인')
  const [type, setType] = useState('interview')
  const [target, setTarget] = useState(10)

  const load = useCallback(async () => {
    const response = await fetch('/api/v1/admin/trust-product', { cache: 'no-store' })
    const payload = await response.json()
    if (response.ok) setData(payload)
    else setError(payload.message ?? '운영 데이터를 불러오지 못했습니다.')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(body: Record<string, unknown>) {
    const response = await fetch('/api/v1/admin/trust-product', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json()
    if (!response.ok) setError(payload.message ?? payload.code ?? '운영 상태를 변경하지 못했습니다.')
    else await load()
  }

  async function createExperiment(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/v1/admin/trust-product', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        experimentType: type,
        targetSegment: segment,
        hypothesis,
        targetCount: target,
        successCriteria: {},
        priceHypothesis: {},
      }),
    })
    const payload = await response.json()
    if (!response.ok) setError(payload.message ?? '검증 계획을 생성하지 못했습니다.')
    else {
      setName('')
      setHypothesis('')
      await load()
    }
  }

  async function changeGate(gate: Record<string, unknown>, status: GateStatus) {
    const reference = status === 'approved'
      ? window.prompt('승인 근거 문서 또는 검토번호를 입력하세요.')?.trim() || null
      : null
    if (status === 'approved' && !reference) return
    await patch({
      resource: 'compliance_gate',
      id: gate.gate_key,
      status,
      approvalReference: reference,
      notes: gate.notes ?? null,
    })
  }

  return (
    <main className="min-h-screen bg-[#171b19] px-4 py-8 text-[#eef2ec]">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-[#3d4742] pb-7">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#f2a65a]">Evidence operations room</p>
          <h1 className="mt-3 font-serif text-4xl">제품 검증·법률 게이트</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aeb8b2]">계획과 실적을 분리하고, 근거가 없는 자동화·외부연동·유료화를 코드 밖이 아니라 운영 상태로 차단합니다.</p>
        </header>
        {error ? <div className="mt-5 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</div> : null}

        <section className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="리포트" value={data.reports.length} />
          <Metric label="검수 대기" value={data.reports.filter((row) => Number(row.pending_review_count) > 0).length} />
          <Metric label="보안검사 대기" value={data.intakes.filter((row) => row.scan_status === 'pending').length} />
          <Metric label="AI 사람검토" value={data.ai_runs.filter((row) => row.human_review_status === 'pending').length} />
          <Metric label="검증 실험" value={data.experiments.length} />
          <Metric label="조직계정" value={data.organizations.length} />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <Panel title="계약 전 리포트 검수">
            <div className="space-y-3">
              {data.reports.slice(0, 12).map((report) => (
                <Link key={String(report.id)} href={'/trust/reports/' + report.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#3b4540] bg-[#202622] p-4 hover:border-[#f2a65a]">
                  <div><strong>{String(report.title)}</strong><p className="mt-1 text-xs text-[#929e97]">{String(report.owner_email ?? '')}</p></div>
                  <span className="rounded-full bg-[#323b36] px-3 py-1 text-xs">{String(report.pending_review_count)} 대기</span>
                </Link>
              ))}
              {data.reports.length === 0 ? <Empty /> : null}
            </div>
          </Panel>

          <Panel title="법률·보안 활성화 게이트">
            <div className="space-y-3">
              {data.gates.map((gate) => (
                <div key={String(gate.gate_key)} className="rounded-xl border border-[#3b4540] bg-[#202622] p-4">
                  <div className="flex items-center justify-between gap-3"><strong>{String(gate.label)}</strong><span className="text-xs uppercase text-[#f2a65a]">{String(gate.status)}</span></div>
                  <p className="mt-2 text-xs leading-5 text-[#929e97]">{JSON.stringify(gate.required_evidence)}</p>
                  {gate.approval_reference ? <p className="mt-2 text-xs text-[#b9c4bd]">승인 근거: {String(gate.approval_reference)}</p> : null}
                  {gate.approved_at ? <p className="mt-1 text-[11px] text-[#7f8b84]">승인 시각: {String(gate.approved_at)}</p> : null}
                  <div className="mt-3 flex gap-2">
                    {(['pending', 'approved', 'blocked'] as const).map((status) => <button key={status} onClick={() => void changeGate(gate, status)} className="rounded-full border border-[#56635c] px-3 py-1 text-[11px] hover:bg-[#343d38]">{status}</button>)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="문서 악성검사·격리">
            <div className="space-y-3">
              {data.intakes.slice(0, 12).map((intake) => (
                <div key={String(intake.id)} className="rounded-xl border border-[#3b4540] bg-[#202622] p-4">
                  <div className="flex items-start justify-between gap-3"><strong className="break-all">{String(intake.original_filename)}</strong><span className="text-xs text-[#f2a65a]">{String(intake.scan_status)}</span></div>
                  <p className="mt-2 font-mono text-[10px] text-[#7f8b84]">{String(intake.file_sha256)}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => void patch({ resource: 'document_intake', id: intake.id, scanStatus: 'clean', scanEngine: 'manual-admin', scanSignatureVersion: 'manual-1', quarantineReason: null })} className="rounded-full border border-emerald-700 px-3 py-1 text-[11px] text-emerald-300">clean</button>
                    <button onClick={() => void patch({ resource: 'document_intake', id: intake.id, scanStatus: 'quarantined', scanEngine: 'manual-admin', scanSignatureVersion: 'manual-1', quarantineReason: '운영자 격리' })} className="rounded-full border border-red-800 px-3 py-1 text-[11px] text-red-300">quarantine</button>
                  </div>
                </div>
              ))}
              {data.intakes.length === 0 ? <Empty /> : null}
            </div>
          </Panel>

          <Panel title="AI 처리 재현·사람 검토">
            <div className="space-y-3">
              {data.ai_runs.slice(0, 12).map((run) => (
                <div key={String(run.id)} className="rounded-xl border border-[#3b4540] bg-[#202622] p-4">
                  <div className="flex items-center justify-between gap-3"><strong>{String(run.provider)} / {String(run.model_name)}</strong><span className="text-xs text-[#f2a65a]">{String(run.human_review_status)}</span></div>
                  <p className="mt-2 text-xs text-[#929e97]">{String(run.purpose)} · 개인정보 {run.contains_personal_data ? '포함' : '미포함'}</p>
                  <div className="mt-3 flex gap-2">
                    {['approved', 'corrected', 'rejected'].map((status) => <button key={status} onClick={() => void patch({ resource: 'ai_run', id: run.id, humanReviewStatus: status, corrections: [] })} className="rounded-full border border-[#56635c] px-3 py-1 text-[11px]">{status}</button>)}
                  </div>
                </div>
              ))}
              {data.ai_runs.length === 0 ? <Empty /> : null}
            </div>
          </Panel>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <form onSubmit={createExperiment} className="rounded-2xl border border-[#3b4540] bg-[#202622] p-5">
            <h2 className="font-serif text-2xl">검증 계획 등록</h2>
            <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="예: 임차인 샘플 리포트 이해도" className="mt-4 w-full rounded-lg border border-[#4b5751] bg-[#171b19] px-3 py-2 text-sm" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-[#4b5751] bg-[#171b19] px-3 py-2 text-sm">
                <option value="interview">인터뷰</option><option value="sample_report">샘플 리포트</option><option value="internal_test">내부시험</option><option value="pilot">파일럿</option><option value="pricing">가격</option><option value="broker_repeat">중개사 반복사용</option><option value="security">보안</option>
              </select>
              <input type="number" min={0} value={target} onChange={(event) => setTarget(Number(event.target.value))} className="rounded-lg border border-[#4b5751] bg-[#171b19] px-3 py-2 text-sm" />
            </div>
            <input value={segment} onChange={(event) => setSegment(event.target.value)} required placeholder="대상 고객군" className="mt-3 w-full rounded-lg border border-[#4b5751] bg-[#171b19] px-3 py-2 text-sm" />
            <textarea value={hypothesis} onChange={(event) => setHypothesis(event.target.value)} required placeholder="검증할 가설과 성공 기준" className="mt-3 min-h-28 w-full rounded-lg border border-[#4b5751] bg-[#171b19] px-3 py-2 text-sm" />
            <button className="mt-3 w-full rounded-lg bg-[#f2a65a] px-4 py-2 font-bold text-[#171b19]">계획으로 등록</button>
          </form>
          <Panel title="목표와 실제 실적 분리">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-[#929e97]"><tr><th className="pb-3">검증</th><th>대상</th><th>상태</th><th>목표</th><th>실제</th></tr></thead>
                <tbody>
                  {data.experiments.map((experiment) => (
                    <tr key={String(experiment.id)} className="border-t border-[#343d38]">
                      <td className="py-3 font-medium">{String(experiment.name)}</td><td>{String(experiment.target_segment)}</td><td>{String(experiment.status)}</td><td>{String(experiment.target_count ?? '-')}</td><td>{String(experiment.actual_count ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.experiments.length === 0 ? <Empty /> : null}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-[#3b4540] bg-[#202622] p-4"><strong className="block font-serif text-3xl text-[#f2a65a]">{value}</strong><span className="mt-1 block text-xs text-[#929e97]">{label}</span></div>
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#3b4540] bg-[#1b201d] p-5"><h2 className="mb-4 font-serif text-2xl">{title}</h2>{children}</section>
}

function Empty() {
  return <p className="py-6 text-center text-sm text-[#77827c]">기록 없음</p>
}
