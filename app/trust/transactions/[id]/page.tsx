'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface Txn { id: string; stage: string | null; terms: Record<string, unknown> | null; created_at: string }
interface Rec { id: string; recommendation_type?: string; value?: Record<string, unknown> | null }

const REC_LABEL: Record<string, string> = {
  deposit_band: '보증금 노출 검토',
  insurance_recommendation: '보증보험 권장',
  special_terms: '표준 특약 확인',
  additional_evidence: '추가 증빙 필요',
  insurance_check: '보증보험 확인',
  deposit_review: '보증금 검토',
  human_review: '전문가 검토',
  standard_checklist: '표준 확인 절차',
}

export default function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [txn, setTxn] = useState<Txn | null>(null)
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/transactions/${id}`, { cache: 'no-store' })
      if (res.status === 401) { router.push(`/login?redirect=/trust/transactions/${id}`); return }
      if (!res.ok) { setError('거래를 찾을 수 없습니다'); return }
      setTxn((await res.json()).transaction)
      const rRes = await fetch(`/api/v1/recommendations/${id}`, { cache: 'no-store' })
      if (rRes.ok) setRecs((await rRes.json()).recommendations ?? [])
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true); setNote(null)
    try {
      const res = await fetch(`/api/v1/recommendations/${id}`, { method: 'POST' })
      if (res.status === 503) {
        setNote('거래조건 자동 분석은 관리자 승인(공정성·법무 검토) 후 이용할 수 있어요.')
      } else if (res.ok) {
        load()
      } else {
        setNote((await res.json().catch(() => null))?.error ?? '분석에 실패했습니다')
      }
    } finally {
      setGenerating(false)
    }
  }

  const terms = txn?.terms ?? {}

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Link href="/trust/transactions" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← 거래 목록</Link>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <Card className="p-6 text-center text-muted-foreground">{error}</Card>
        ) : txn ? (
          <>
            <Card className="mb-6 p-5">
              <h1 className="text-xl font-bold">{(terms.address as string) || '거래'}</h1>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {terms.deposit != null && <div><dt className="text-muted-foreground">보증금</dt><dd className="font-medium">{String(terms.deposit)}만원</dd></div>}
                {terms.monthlyRent != null && <div><dt className="text-muted-foreground">월세</dt><dd className="font-medium">{String(terms.monthlyRent)}만원</dd></div>}
                {terms.plannedContractDate ? <div><dt className="text-muted-foreground">계약 예정일</dt><dd className="font-medium">{String(terms.plannedContractDate)}</dd></div> : null}
              </dl>
            </Card>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">거래조건 · 확인 항목</h2>
              <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
                {generating ? '분석 중…' : '거래조건 분석'}
              </Button>
            </div>
            {note && <Card className="mb-3 bg-secondary/50 p-3 text-xs text-secondary-foreground">{note}</Card>}
            {recs.length === 0 ? (
              <Card className="p-5 text-sm text-muted-foreground">
                아직 도출된 거래조건·확인 항목이 없어요. 증빙을 등록하고 분석을 실행하면 보증금·보증보험·추가서류 등 확인 항목이 만들어집니다.
              </Card>
            ) : (
              <ul className="space-y-2">
                {recs.map((r) => {
                  const v = r.value ?? {}
                  const label = (v.label as string) || REC_LABEL[r.recommendation_type ?? ''] || r.recommendation_type || '확인 항목'
                  const detail = v.detail as string | undefined
                  const items = Array.isArray(v.items) ? (v.items as string[]) : null
                  return (
                    <li key={r.id}>
                      <Card className="p-4">
                        <p className="text-sm font-semibold">{label}</p>
                        {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
                        {items && (
                          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                            {items.map((it, i) => <li key={i}>{it}</li>)}
                          </ul>
                        )}
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-6 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              내 신뢰 상태와 검증 근거는 <Link href="/trust-center" className="text-primary underline">신뢰센터</Link>에서 확인할 수 있어요.
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
