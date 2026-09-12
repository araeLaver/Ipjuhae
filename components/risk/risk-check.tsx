'use client'

import Link from 'next/link'
import { useState } from 'react'

// 랜딩과 같은 팔레트를 쓴다. 진단에서 신청으로 이어질 때 같은 서비스로 읽혀야 한다.
const NAVY = '#0C2247'
const AMBER = '#E9A23B'

interface RiskBrief {
  match: { complexId: string | null; grade: string; method: string }
  comparison: {
    scope: 'complex_area' | 'complex_area_expanded' | 'district' | 'insufficient'
    periodMonths: number
    sampleCount: number
    lastContractDate: string | null
  }
  metrics: {
    pricePosition: { depositPercentile: number | null; monthlyRentPercentile: number | null }
    depositMedianDifferenceRate: number | null
    shortTermDepositChangeRate: number | null
    sampleAdequacy: 'high' | 'medium' | 'low'
    matchingConfidence: string
  }
  signals: string[]
  limitations: string[]
  sourceAsOf: string
}

const SCOPE_LABEL: Record<RiskBrief['comparison']['scope'], string> = {
  complex_area: '같은 단지 · 같은 평형',
  complex_area_expanded: '같은 단지 · 비슷한 평형',
  district: '같은 자치구 · 비슷한 평형',
  insufficient: '비교할 거래를 찾지 못함',
}

/** 만원 단위를 억/만원으로 읽기 쉽게 */
function won(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000)
    const rest = manwon % 10000
    return rest ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`
  }
  return `${manwon.toLocaleString()}만원`
}

const pct = (rate: number) => `${rate > 0 ? '+' : ''}${Math.round(rate * 1000) / 10}%`

export function RiskCheck() {
  const [address, setAddress] = useState('')
  const [complexName, setComplexName] = useState('')
  const [areaM2, setAreaM2] = useState('')
  const [deposit, setDeposit] = useState('')
  const [rent, setRent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brief, setBrief] = useState<RiskBrief | null>(null)

  const fillSample = () => {
    setAddress('서울 강남구 대치동 316')
    setComplexName('은마아파트')
    setAreaM2('84.43')
    setDeposit('56500')
    setRent('0')
    setError(null)
    setBrief(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBrief(null)

    const area = Number(areaM2)
    const dep = Number(deposit)
    const mon = Number(rent || '0')
    if (!address.trim() || !complexName.trim()) {
      setError('주소와 단지명을 입력해주세요')
      return
    }
    if (!Number.isFinite(area) || area <= 0) {
      setError('전용면적을 숫자로 입력해주세요')
      return
    }
    if (!Number.isInteger(dep) || dep < 0) {
      setError('보증금을 만원 단위 숫자로 입력해주세요')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/rental-risk/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          complexName: complexName.trim(),
          areaM2: area,
          depositManwon: dep,
          monthlyRentManwon: Number.isInteger(mon) ? mon : 0,
        }),
      })
      if (!res.ok) {
        setError('조회에 실패했어요. 입력을 확인하고 다시 시도해주세요')
        return
      }
      setBrief((await res.json()) as RiskBrief)
    } catch {
      setError('네트워크 오류가 발생했어요')
    } finally {
      setLoading(false)
    }
  }

  // 표본이 5건 미만이면 수치를 아예 보여주지 않는다.
  // 근거가 얇은 숫자를 신뢰 서비스가 내보이면 안 된다.
  const enough = brief ? brief.comparison.sampleCount >= 5 && brief.comparison.scope !== 'insufficient' : false
  const percentile = brief?.metrics.pricePosition.depositPercentile ?? null
  const diff = brief?.metrics.depositMedianDifferenceRate ?? null

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: NAVY, fontFamily: "'Pretendard Variable', Pretendard, 'Noto Sans KR', system-ui, sans-serif" }}
    >
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-extrabold tracking-tight">
          입주해
        </Link>
        <span className="rounded-full border border-white/25 px-3.5 py-1.5 text-xs text-white/70">
          시세 비교 · 시험판
        </span>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          이 보증금,
          <br />
          시세에 비해 어떤가요
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-white/70">
          같은 단지 같은 평형의 최근 실거래와 비교해 보증금 위치를 알려드려요.
          <strong className="font-semibold text-white"> 등기부·권리관계는 확인하지 않습니다.</strong>
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="rc-address" className="mb-1.5 block text-sm font-medium text-white/90">
              주소
            </label>
            <input
              id="rc-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="서울 강남구 대치동 316"
              className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-base text-white placeholder:text-white/35 focus:border-[#E9A23B] focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rc-complex" className="mb-1.5 block text-sm font-medium text-white/90">
                단지명
              </label>
              <input
                id="rc-complex"
                value={complexName}
                onChange={(e) => setComplexName(e.target.value)}
                placeholder="은마아파트"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-base text-white placeholder:text-white/35 focus:border-[#E9A23B] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="rc-area" className="mb-1.5 block text-sm font-medium text-white/90">
                전용면적 <span className="font-normal text-white/50">(㎡)</span>
              </label>
              <input
                id="rc-area"
                inputMode="decimal"
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                placeholder="84.43"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-base text-white placeholder:text-white/35 focus:border-[#E9A23B] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rc-deposit" className="mb-1.5 block text-sm font-medium text-white/90">
                보증금 <span className="font-normal text-white/50">(만원)</span>
              </label>
              <input
                id="rc-deposit"
                inputMode="numeric"
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                placeholder="56500"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-base text-white placeholder:text-white/35 focus:border-[#E9A23B] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="rc-rent" className="mb-1.5 block text-sm font-medium text-white/90">
                월세 <span className="font-normal text-white/50">(만원 · 전세면 0)</span>
              </label>
              <input
                id="rc-rent"
                inputMode="numeric"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-base text-white placeholder:text-white/35 focus:border-[#E9A23B] focus:outline-none"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-lg bg-red-500/15 px-4 py-2.5 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-7 py-3.5 text-base font-bold text-[#0C2247] transition hover:brightness-105 disabled:opacity-60"
              style={{ backgroundColor: AMBER }}
            >
              {loading ? '조회 중…' : '시세와 비교하기'}
            </button>
            <button
              type="button"
              onClick={fillSample}
              className="rounded-lg border border-white/25 px-4 py-3.5 text-sm text-white/80 transition hover:border-white/50"
            >
              예시로 채우기
            </button>
          </div>
        </form>

        {brief ? (
          <section className="mt-10 rounded-2xl border border-white/15 bg-white/5 p-6 sm:p-8">
            {enough && percentile !== null ? (
              <>
                <p className="text-sm text-white/60">
                  {SCOPE_LABEL[brief.comparison.scope]} · 최근 {brief.comparison.periodMonths}개월 ·{' '}
                  거래 {brief.comparison.sampleCount}건
                </p>
                <h2 className="mt-3 text-2xl font-extrabold leading-snug sm:text-3xl">
                  이 보증금은 최근 거래 중
                  <br />
                  <span style={{ color: AMBER }}>상위 {Math.max(1, 100 - percentile)}%</span> 입니다
                </h2>

                <div className="mt-7">
                  <div className="relative h-2.5 w-full rounded-full bg-white/15">
                    <div
                      className="absolute -top-1 h-4.5 w-1.5 rounded-full"
                      style={{ left: `calc(${percentile}% - 3px)`, backgroundColor: AMBER, height: '18px', top: '-4px' }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-white/45">
                    <span>낮음</span>
                    <span>중앙값</span>
                    <span>높음</span>
                  </div>
                </div>

                <dl className="mt-7 grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-3">
                  <div className="bg-[#0C2247] p-4">
                    <dt className="text-xs text-white/55">중앙값 대비</dt>
                    <dd className="mt-1 text-lg font-bold">
                      {diff === null ? '—' : pct(diff)}
                    </dd>
                  </div>
                  <div className="bg-[#0C2247] p-4">
                    <dt className="text-xs text-white/55">최근 3개월 추세</dt>
                    <dd className="mt-1 text-lg font-bold">
                      {brief.metrics.shortTermDepositChangeRate === null
                        ? '표본 부족'
                        : pct(brief.metrics.shortTermDepositChangeRate)}
                    </dd>
                  </div>
                  <div className="bg-[#0C2247] p-4">
                    <dt className="text-xs text-white/55">표본 적정성</dt>
                    <dd className="mt-1 text-lg font-bold">
                      {{ high: '충분', medium: '보통', low: '부족' }[brief.metrics.sampleAdequacy]}
                    </dd>
                  </div>
                </dl>

                {deposit ? (
                  <p className="mt-5 text-sm text-white/60">
                    입력하신 보증금 {won(Number(deposit))} 기준입니다.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold leading-snug">판단할 표본이 부족합니다</h2>
                <p className="mt-3 leading-relaxed text-white/70">
                  {brief.comparison.scope === 'insufficient'
                    ? '입력하신 주소·단지와 맞는 최근 거래를 찾지 못했어요.'
                    : `비교 가능한 거래가 ${brief.comparison.sampleCount}건뿐이라 수치로 말씀드리기 어렵습니다.`}
                  {' '}근거가 얇은 숫자는 보여드리지 않습니다.
                </p>
              </>
            )}

            {brief.signals.length ? (
              <div className="mt-7 space-y-2">
                <p className="text-xs font-semibold tracking-wide text-white/50">확인이 필요한 신호</p>
                {brief.signals.map((s) => (
                  <p
                    key={s}
                    className="rounded-lg border-l-2 bg-white/5 px-4 py-3 text-sm text-white/85"
                    style={{ borderLeftColor: AMBER }}
                  >
                    {s}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-7 border-t border-white/10 pt-5">
              <p className="text-xs font-semibold tracking-wide text-white/50">이 결과의 한계</p>
              <ul className="mt-2 space-y-1.5">
                {brief.limitations.map((l) => (
                  <li key={l} className="text-xs leading-relaxed text-white/55">
                    · {l}
                  </li>
                ))}
                <li className="text-xs leading-relaxed text-white/55">
                  · 기준일 {brief.sourceAsOf} · 공개 실거래 자료 기준
                </li>
              </ul>
            </div>

            <div className="mt-7 rounded-xl p-5" style={{ backgroundColor: AMBER, color: NAVY }}>
              <p className="text-base font-bold">등기부까지 같이 확인하고 싶으세요?</p>
              <p className="mt-1.5 text-sm leading-relaxed opacity-80">
                근저당·신탁·소유자 확인은 준비 중입니다. 먼저 알려드릴게요.
              </p>
              <Link
                href="/#waitlist-form"
                className="mt-4 inline-block rounded-lg bg-[#0C2247] px-5 py-3 text-sm font-bold text-white transition hover:brightness-125"
              >
                사전 신청하기
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
