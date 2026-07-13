'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface PublicItem {
  subject_type: string
  label: string
  verification_status: string
  source_name: string | null
  source_observed_at: string | null
  valid_until: string | null
  public_value: unknown
  missing_reason: string | null
  next_action: string | null
}

interface PublicCard {
  card: {
    title: string
    report_title: string
    contract_address: string | null
    purpose: string
    audience_role: string
    expires_at: string
  }
  items: PublicItem[]
  disclaimer: string
}

export default function PublicTrustCardPage() {
  const params = useParams<{ token: string }>()
  const [data, setData] = useState<PublicCard | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/v1/public/trust-cards/' + params.token + '?purpose=contract_review', { cache: 'no-store' })
      const payload = await response.json()
      if (response.ok) setData(payload)
      else setError(response.status === 410 ? '이 Trust Card는 만료되었거나 회수되었습니다.' : 'Trust Card를 확인할 수 없습니다.')
    })()
  }, [params.token])

  if (!data) {
    return <main className="grid min-h-screen place-items-center bg-[#153d34] p-6"><div className="max-w-lg rounded-3xl bg-white p-8 text-center text-stone-700">{error || '공개 범위를 확인하는 중...'}</div></main>
  }

  const groups = ['tenant', 'landlord', 'property', 'broker']
  return (
    <main className="min-h-screen bg-[#153d34] px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#faf7ef] shadow-2xl">
        <header className="border-b border-stone-300 bg-[#f4c56d] p-8 md:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-stone-700">Verified status, limited disclosure</p>
          <h1 className="mt-3 font-serif text-4xl md:text-5xl">{data.card.title}</h1>
          <p className="mt-3 text-sm text-stone-700">{data.card.contract_address || data.card.report_title}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white/60 px-3 py-1">목적: {data.card.purpose}</span>
            <span className="rounded-full bg-white/60 px-3 py-1">만료: {new Date(data.card.expires_at).toLocaleString('ko-KR')}</span>
          </div>
        </header>
        <div className="p-6 md:p-10">
          {groups.map((subject) => {
            const items = data.items.filter((item) => item.subject_type === subject)
            if (items.length === 0) return null
            return (
              <section key={subject} className="mb-8">
                <h2 className="mb-3 font-serif text-2xl capitalize">{subject}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => (
                    <article key={subject + item.label} className="rounded-2xl border border-stone-200 bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{item.label}</strong>
                        <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold">{item.verification_status}</span>
                      </div>
                      <p className="mt-4 text-sm font-medium text-stone-800">{display(item.public_value) || item.missing_reason || '공개된 값 없음'}</p>
                      <p className="mt-2 text-xs leading-5 text-stone-500">출처 {item.source_name || '-'} · 기준일 {item.source_observed_at ? new Date(item.source_observed_at).toLocaleDateString('ko-KR') : '-'}</p>
                      {item.next_action ? <p className="mt-3 border-l-2 border-orange-400 pl-3 text-xs leading-5 text-stone-600">{item.next_action}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
          <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-xs leading-6 text-amber-950">{data.disclaimer}</aside>
        </div>
      </div>
    </main>
  )
}

function display(value: unknown) {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

