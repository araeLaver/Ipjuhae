'use client'

import { useEffect, useState } from 'react'

interface DataScore {
  score: number
  factCount: number
  dimensions: { clarity: number; completeness: number; recency: number; consistency: number; verifiability: number }
}

const DIMS: { key: keyof DataScore['dimensions']; label: string }[] = [
  { key: 'clarity', label: '출처 명확성' },
  { key: 'completeness', label: '완전성' },
  { key: 'recency', label: '최신성' },
  { key: 'consistency', label: '일관성' },
  { key: 'verifiability', label: '검증 가능성' },
]

export function DataScoreCard() {
  const [data, setData] = useState<DataScore | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    fetch('/api/v1/data-score', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.score === 'number') { setData(d); setShow(true) } })
      .catch(() => {})
  }, [])

  if (!show || !data) return null

  return (
    <section className="mt-7 rounded-2xl border border-[#18342e]/12 bg-[#f8f4e8] p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b64d31]">DATA SCORE</p>
          <p className="mt-1 text-sm text-[#18342e]/70">내 검증 자료의 품질 (출처·완전성·최신성·일관성·검증가능성)</p>
        </div>
        <div className="text-right">
          <span className="text-4xl font-black text-[#18342e]">{data.score}</span>
          <span className="text-sm text-[#18342e]/60">/100</span>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {DIMS.map((d) => {
          const pct = Math.round((data.dimensions[d.key] ?? 0) * 100)
          return (
            <div key={d.key}>
              <div className="mb-1 flex justify-between text-xs text-[#18342e]/70">
                <span>{d.label}</span><span>{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#18342e]/10">
                <div className="h-full rounded-full bg-[#de6b48]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-4 text-xs text-[#18342e]/50">
        가중치는 파일럿(동일 20%)입니다. 근거 기반 재조정 및 법무 검토 전까지 잠정 지표입니다.
      </p>
    </section>
  )
}
