'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { FileText } from 'lucide-react'

interface Me { id: string; userType: string | null }
interface Txn {
  id: string
  stage: string | null
  terms: Record<string, unknown> | null
  created_at: string
}

const STAGE_LABEL: Record<string, string> = {
  pre_application: '신청 전', S0: '신청 전',
  application: '신청', S1: '신청',
  negotiation: '협의', S2: '협의',
  contract: '계약', S3: '계약', S4: '계약', S5: '계약', S6: '계약',
  completed: '완료', S7: '완료', S8: '완료',
  cancelled: '취소',
}

function roleField(userType: string | null): 'tenantId' | 'landlordId' | 'realtorId' | null {
  if (userType === 'tenant') return 'tenantId'
  if (userType === 'landlord') return 'landlordId'
  if (userType === 'broker') return 'realtorId'
  return null
}

export default function TransactionsPage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [deposit, setDeposit] = useState('')
  const [rent, setRent] = useState('')
  const [date, setDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .finally(() => setReady(true))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/transactions', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login?redirect=/trust/transactions'); return }
      const data = await res.json()
      setTxns(data.transactions ?? [])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { if (ready) load() }, [ready, load])

  const field = roleField(me?.userType ?? null)

  async function submit() {
    if (!me || !field || !address.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: me.id,
          stage: 'pre_application',
          terms: {
            address: address.trim(),
            deposit: deposit ? Number(deposit) : null,
            monthlyRent: rent ? Number(rent) : null,
            plannedContractDate: date || null,
          },
        }),
      })
      if (res.ok) {
        setAddress(''); setDeposit(''); setRent(''); setDate(''); setOpen(false)
        load()
      } else {
        alert((await res.json().catch(() => null))?.error ?? '거래 등록에 실패했습니다')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">거래</h1>
            <p className="text-sm text-muted-foreground">계약 전 신뢰 리포트를 만들 거래를 등록하세요.</p>
          </div>
          {field && <Button onClick={() => setOpen((v) => !v)}>거래 등록</Button>}
        </div>

        {open && field && (
          <Card className="mb-6 space-y-3 p-4">
            <Input placeholder="주소 (예: 서울시 강남구 …)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="보증금 (만원)" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/[^0-9]/g, ''))} />
              <Input placeholder="월세 (만원)" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value.replace(/[^0-9]/g, ''))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">계약 예정일</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
              <Button onClick={submit} disabled={submitting || !address.trim()}>{submitting ? '등록 중…' : '등록'}</Button>
            </div>
          </Card>
        )}

        {!field && ready && (
          <Card className="mb-6 p-4 text-sm text-muted-foreground">
            거래 등록은 임차인·임대인·공인중개사 계정에서 가능합니다.
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : txns.length === 0 ? (
          <EmptyState icon={<FileText className="h-10 w-10" />} title="등록된 거래가 없어요" description="거래를 등록하면 신뢰 리포트를 만들 수 있어요." />
        ) : (
          <ul className="space-y-3">
            {txns.map((t) => (
              <li key={t.id}>
                <Link href={`/trust/transactions/${t.id}`}>
                  <Card className="p-4 transition-shadow hover:shadow-card">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                        {STAGE_LABEL[t.stage ?? ''] ?? t.stage ?? '진행중'}
                      </span>
                      <span>{new Date(t.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="font-semibold">{(t.terms?.address as string) || '주소 미입력'}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
