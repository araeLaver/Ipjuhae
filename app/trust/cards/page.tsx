'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface Card {
  id: string
  title: string
  report_title: string
  audience_role: string
  purpose: string
  status: string
  token_prefix: string
  allowed_views: number
  expires_at: string
  created_at: string
}

export default function TrustCardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await fetch('/api/v1/trust-cards', { cache: 'no-store' })
    const payload = await response.json()
    if (response.ok) setCards(payload.cards ?? [])
    else setError(payload.message ?? 'Trust Card를 불러오지 못했습니다.')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(id: string) {
    const response = await fetch('/api/v1/trust-cards/' + id, { method: 'PATCH' })
    const payload = await response.json()
    if (!response.ok) setError(payload.message ?? '카드를 회수하지 못했습니다.')
    else await load()
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(120deg,#0f392f_0%,#1c5545_42%,#f1e8d5_42%,#faf7ef_100%)] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-white/95 p-7 shadow-2xl md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-800">Purpose-bound disclosure</p>
          <h1 className="mt-3 font-serif text-4xl text-stone-900 md:text-5xl">Trust Card</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">원문 대신 승인된 확인상태만 수신자·목적·만료일에 묶어 공개합니다. 공유주소 원문은 발급 직후 한 번만 표시됩니다.</p>
          <div className="mt-6 flex gap-3">
            <Link href="/trust/reports" className="rounded-full bg-emerald-800 px-4 py-2 text-sm font-bold text-white">리포트에서 발급</Link>
            <Link href="/trust-center" className="rounded-full border border-stone-300 px-4 py-2 text-sm">신뢰센터</Link>
          </div>
        </header>
        {error ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-800">{error}</div> : null}
        <section className="mt-7 grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.id} className="rounded-3xl border border-white/40 bg-white/95 p-6 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">{card.status}</span>
                  <h2 className="mt-2 text-xl font-bold text-stone-900">{card.title}</h2>
                  <p className="mt-1 text-sm text-stone-500">{card.report_title}</p>
                </div>
                <span className="rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs text-stone-500">{card.token_prefix}...</span>
              </div>
              <dl className="mt-5 grid gap-2 text-sm text-stone-600">
                <div className="flex justify-between gap-3"><dt>공개 목적</dt><dd className="text-right font-medium">{card.purpose}</dd></div>
                <div className="flex justify-between gap-3"><dt>수신자 역할</dt><dd>{card.audience_role}</dd></div>
                <div className="flex justify-between gap-3"><dt>허용 열람</dt><dd>{card.allowed_views ?? 0}회</dd></div>
                <div className="flex justify-between gap-3"><dt>만료</dt><dd>{new Date(card.expires_at).toLocaleString('ko-KR')}</dd></div>
              </dl>
              {card.status === 'issued' ? <button onClick={() => void revoke(card.id)} className="mt-5 rounded-full border border-red-300 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50">즉시 회수</button> : null}
            </article>
          ))}
          {cards.length === 0 ? <div className="rounded-3xl border border-dashed border-white/60 bg-white/80 p-10 text-center text-stone-500">발급된 Trust Card가 없습니다.</div> : null}
        </section>
      </div>
    </main>
  )
}

