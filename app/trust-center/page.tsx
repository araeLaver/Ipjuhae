'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Activity, FileCheck2, Fingerprint, GitBranch, LockKeyhole, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'

interface ScoreRun {
  subject_type: string
  score: number | string
  band: string
  confidence: number | string
  model_version: string
  reason_codes: string[]
  created_at: string
}

interface TrustReport {
  scores: ScoreRun[]
  facts: Array<{ id: string; field_name: string; status: string; quality: number | string; reason_codes: string[]; valid_until: string | null }>
  transactions: Array<{ id: string; stage: string; status: string; created_at: string }>
  reviews: Array<{ id: string; reason: string; status: string; decision: string | null; created_at: string }>
  disclosures: Array<{ id: string; policy_version: string; claims: Record<string, unknown>; state: string; expires_at: string }>
  audit: Array<{ action: string; purpose: string; result: string; occurred_at: string }>
  graph: { trustValue: number; confidence: number; evidenceCount: number; interval: number[] }
}

const EMPTY: TrustReport = { scores: [], facts: [], transactions: [], reviews: [], disclosures: [], audit: [], graph: { trustValue: 50, confidence: 0.15, evidenceCount: 0, interval: [25, 75] } }

export default function TrustCenterPage() {
  const [report, setReport] = useState<TrustReport>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/v1/trust/report', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? '신뢰 리포트를 불러오지 못했습니다')
      setReport(payload as TrustReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : '신뢰 리포트를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])
  const latestScore = report.scores[0]

  return (
    <div className="min-h-screen bg-[#f3f0e8] text-[#18342e]">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#18342e]/15 bg-[#f8f4e8] p-7 shadow-[0_24px_80px_rgba(24,52,46,0.12)] sm:p-10">
          <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#de6b48]/20 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-[#6f9d84]/25 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#b64d31]">
                <Fingerprint className="h-4 w-4" /> Evidence-bound trust
              </div>
              <h1 className="font-serif text-4xl font-black leading-[1.05] sm:text-6xl">내 신뢰의 근거와<br />사용 경로를 한곳에서.</h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-[#18342e]/70 sm:text-base">점수만 보여주지 않습니다. 어떤 사실이 사용됐고, 누구에게 무엇이 공개됐으며, 정정이 어디까지 전파됐는지 확인합니다.</p>
            </div>
            <Button onClick={() => void load()} disabled={loading} className="gap-2 bg-[#18342e] text-[#f8f4e8] hover:bg-[#244b42]">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
            </Button>
          </div>
        </section>

        {error ? <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        <section className="mt-7 grid gap-4 md:grid-cols-3">
          <Metric icon={ShieldCheck} label="최신 신뢰 참고값" value={latestScore ? `${Math.round(Number(latestScore.score))}` : '50'} note={latestScore ? `${latestScore.band} · ${latestScore.model_version}` : '검증 근거가 쌓이면 갱신됩니다'} />
          <Metric icon={GitBranch} label="거래 신뢰 그래프" value={`${Math.round(report.graph.trustValue)}`} note={`${report.graph.evidenceCount}개 거래 근거 · 확신도 ${Math.round(report.graph.confidence * 100)}%`} />
          <Metric icon={LockKeyhole} label="활성 공개 패키지" value={`${report.disclosures.filter((item) => item.state === 'ISSUED').length}`} note="수신자·목적·만료가 묶인 최소 공개" />
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="검증 사실" icon={FileCheck2}>
            {report.facts.length === 0 ? <Empty text="등록된 검증 사실이 없습니다." /> : report.facts.slice(0, 10).map((fact) => (
              <Row key={fact.id} title={fact.field_name} badge={fact.status} detail={`품질 ${Math.round(Number(fact.quality) * 100)}%${fact.valid_until ? ` · ${new Date(fact.valid_until).toLocaleDateString()}까지` : ''}`} />
            ))}
          </Panel>
          <Panel title="정정·이의제기" icon={TriangleAlert}>
            {report.reviews.length === 0 ? <Empty text="진행 중인 정정 요청이 없습니다." /> : report.reviews.slice(0, 8).map((review) => (
              <Row key={review.id} title={review.reason} badge={review.status} detail={review.decision ?? new Date(review.created_at).toLocaleString()} />
            ))}
          </Panel>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="최소 공개 기록" icon={LockKeyhole}>
            {report.disclosures.length === 0 ? <Empty text="공개 패키지 발급 기록이 없습니다." /> : report.disclosures.slice(0, 8).map((item) => (
              <Row key={item.id} title={Object.keys(item.claims).join(', ') || '공개 사실'} badge={item.state} detail={`${item.policy_version} · ${new Date(item.expires_at).toLocaleString()} 만료`} />
            ))}
          </Panel>
          <Panel title="처리 감사 기록" icon={Activity}>
            {report.audit.length === 0 ? <Empty text="감사 이벤트가 아직 없습니다." /> : report.audit.slice(0, 8).map((item, index) => (
              <Row key={`${item.action}-${index}`} title={item.action} badge={item.result} detail={`${item.purpose} · ${new Date(item.occurred_at).toLocaleString()}`} />
            ))}
          </Panel>
        </section>
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof ShieldCheck; label: string; value: string; note: string }) {
  return <Card className="rounded-3xl border-[#18342e]/15 bg-[#fffdf6] shadow-none"><CardContent className="p-6"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[#18342e]/55">{label}</span><Icon className="h-5 w-5 text-[#de6b48]" /></div><div className="mt-5 font-serif text-5xl font-black">{value}</div><p className="mt-2 text-xs leading-5 text-[#18342e]/60">{note}</p></CardContent></Card>
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof ShieldCheck; children: React.ReactNode }) {
  return <Card className="rounded-3xl border-[#18342e]/15 bg-[#fffdf6] shadow-none"><CardContent className="p-6"><h2 className="mb-5 flex items-center gap-2 font-serif text-xl font-black"><Icon className="h-5 w-5 text-[#de6b48]" />{title}</h2><div className="space-y-3">{children}</div></CardContent></Card>
}

function Row({ title, badge, detail }: { title: string; badge: string; detail: string }) {
  return <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#18342e]/10 bg-[#f8f4e8]/70 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#18342e]/55">{detail}</p></div><span className="shrink-0 rounded-full bg-[#18342e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#fffdf6]">{badge}</span></div>
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-[#18342e]/20 px-4 py-8 text-center text-sm text-[#18342e]/50">{text}</div>
}

