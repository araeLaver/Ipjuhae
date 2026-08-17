'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle2 } from 'lucide-react'

interface Me { id: string; userType: string | null }

// Real tenant scoring fields (tenant-trust-1.0 model).
const TENANT_FIELDS: { field: string; label: string; hint: string }[] = [
  { field: 'identity_verified', label: '신원 확인', hint: '신분증·본인확인 자료' },
  { field: 'employment_verified', label: '재직 확인', hint: '재직증명서·건강보험 자격득실' },
  { field: 'income_requirement_met', label: '소득 요건', hint: '소득금액증명·급여명세' },
  { field: 'credit_verified', label: '신용 확인', hint: '신용점수·연체 이력 자료' },
  { field: 'relationship_verified', label: '관계·레퍼런스', hint: '이전 임대인 레퍼런스' },
  { field: 'payment_reliable', label: '납부 신뢰', hint: '임대료·공과금 납부 이력' },
]

export default function EvidencePage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .finally(() => setReady(true))
  }, [])

  async function submit(field: string) {
    if (!me) { router.push('/login?redirect=/trust/evidence'); return }
    setBusy(field)
    try {
      const res = await fetch('/api/v1/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: 'tenant',
          subjectId: me.id,
          sourceCode: 'user_upload',
          fieldName: field,
          normalizedValue: true,
          storageRef: notes[field]?.trim() || null,
        }),
      })
      if (res.ok) {
        setSubmitted((s) => ({ ...s, [field]: true }))
      } else {
        alert((await res.json().catch(() => null))?.error ?? '제출에 실패했습니다')
      }
    } finally {
      setBusy(null)
    }
  }

  const isTenant = me?.userType === 'tenant'

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Link href="/trust-center" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← 신뢰센터</Link>
        <h1 className="text-2xl font-bold">검증 자료 제출</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          제출한 자료는 검수 후 검증값으로 반영됩니다. 원문은 상대방에게 그대로 공개되지 않습니다.
        </p>

        {!ready ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : !isTenant ? (
          <Card className="p-5 text-sm text-muted-foreground">검증 자료 제출은 임차인 계정에서 이용할 수 있어요.</Card>
        ) : (
          <ul className="space-y-3">
            {TENANT_FIELDS.map((f) => (
              <li key={f.field}>
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.hint}</p>
                    </div>
                    {submitted[f.field] ? (
                      <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> 제출됨</span>
                    ) : (
                      <Button size="sm" onClick={() => submit(f.field)} disabled={busy === f.field}>
                        {busy === f.field ? '제출 중…' : '제출'}
                      </Button>
                    )}
                  </div>
                  {!submitted[f.field] && (
                    <Input
                      className="mt-3"
                      placeholder="자료 링크·메모 (선택)"
                      value={notes[f.field] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [f.field]: e.target.value }))}
                    />
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
