'use client'

/**
 * 보증금 위험 점검 (웹).
 *
 * 앱의 `mobile/src/screens/DepositCheckScreen.tsx`와 같은 계산을 쓴다.
 * 숫자는 전부 사용자가 등기부와 시세에서 직접 읽어 넣는다. 우리가 채워 넣지 않는다.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TesterInvite } from '@/components/tester-invite'
import { ShareCheck } from '@/components/share-check'
import { CheckNextActions } from '@/components/check-next-actions'
import { checkQuestionHref } from '@/lib/check-next-actions'
import { CheckCandidates } from '@/components/check-candidates'
import { MarketPricePicker } from '@/components/market-price-picker'
import { track } from '@/lib/analytics-client'
import { depositGuidePath } from '@/lib/check-activation'
import { getAttribution } from '@/lib/attribution'
import {
  calculateDepositRisk,
  cushionLabel,
  manwon,
  type DepositRiskResult,
  type RiskLevel,
} from '@/lib/deposit-risk'

const LEVEL_STYLE: Record<RiskLevel, { className: string; label: string }> = {
  safe: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '여유 있음' },
  caution: { className: 'bg-amber-50 text-amber-700 border-amber-200', label: '주의' },
  danger: { className: 'bg-red-50 text-red-700 border-red-200', label: '위험' },
  critical: { className: 'bg-red-50 text-red-700 border-red-200', label: '매우 위험' },
}

interface FieldProps {
  id: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}

function Field({ id, label, hint, value, onChange, placeholder }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={placeholder}
          maxLength={9}
          className="tabular-nums"
        />
        <span className="shrink-0 text-sm text-muted-foreground">만원</span>
      </div>
      {value ? <p className="text-xs text-primary">{manwon(Number(value))}</p> : null}
    </div>
  )
}

export function DepositRiskCheck() {
  const [price, setPrice] = useState('')
  const [deposit, setDeposit] = useState('')
  const [mortgage, setMortgage] = useState('')
  const [prior, setPrior] = useState('')
  const [result, setResult] = useState<DepositRiskResult | null>(null)

  const started = useRef(false)
  function update(setter: (value: string) => void, value: string) {
    setter(value)
    setResult(null)
    if (value && !started.current) {
      started.current = true
      track('check_started', { properties: { surface: 'web', ...getAttribution() } })
    }
  }
  function nextAction(action: 'ask' | 'contract_talk' | 'guide') {
    track('check_next_action_clicked', {
      properties: { surface: 'web', level: result?.level, action, ...getAttribution() },
    })
  }

  const ready = price.length > 0 && deposit.length > 0 && Number(price) > 0

  /**
   * 결과가 화면에 그려진 순간을 익명으로 센다.
   * 보내는 건 화면 구분과 위험 등급뿐이다. 넣으신 금액은 서버로 가지 않는다 —
   * 위 안내문에 그렇게 적어 뒀고, 계측 때문에 그 말이 거짓이 되면 안 된다.
   */
  useEffect(() => {
    if (!result) return
    track('check_result_viewed', {
      properties: { surface: 'web', level: result.level, ...getAttribution() },
    })
  }, [result])

  function run() {
    if (!ready) return
    setResult(
      calculateDepositRisk({
        marketPriceManwon: Number(price),
        depositManwon: Number(deposit),
        mortgageMaxManwon: Number(mortgage || 0),
        priorDepositsManwon: Number(prior || 0),
      })
    )
  }

  function reset() {
    setPrice('')
    setDeposit('')
    setMortgage('')
    setPrior('')
    setResult(null)
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header className="space-y-3">
        <h1 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">
          보증금, 돌려받을 수 있는 집인가
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          등기부와 시세에서 읽은 숫자를 넣으면 계산해 드립니다. 넣으신 숫자는 서버로 보내지 않습니다.
        </p>
      </header>

      <Card className="space-y-5 p-5 sm:p-6">
        <Field
          id="price"
          label="매매 시세"
          hint="네이버 부동산이나 실거래가에서 본 값"
          value={price}
          onChange={(value) => update(setPrice, value)}
          placeholder="40000"
        />
        {/* 시세 칸 바로 아래에 둔다. 막히는 지점에서 손이 닿아야 쓴다. */}
        <MarketPricePicker onPick={(p) => update(setPrice, String(p))} depositManwon={Number(deposit) || undefined} />

        <Field
          id="deposit"
          label="내 보증금"
          hint="계약하려는 전세금 또는 보증금"
          value={deposit}
          onChange={(value) => update(setDeposit, value)}
          placeholder="30000"
        />
        <Field
          id="mortgage"
          label="근저당 채권최고액"
          hint="등기부 을구에 적힌 금액의 합계. 없으면 비워두세요"
          value={mortgage}
          onChange={(value) => update(setMortgage, value)}
          placeholder="0"
        />
        <Field
          id="prior"
          label="선순위 보증금"
          hint="다가구라면 나보다 먼저 들어온 세입자들의 보증금 합계"
          value={prior}
          onChange={(value) => update(setPrior, value)}
          placeholder="0"
        />

        <Button onClick={run} disabled={!ready} className="w-full" size="lg">
          확인하기
        </Button>
        {!ready ? (
          <p className="text-center text-xs text-muted-foreground">
            시세와 보증금은 넣어주셔야 계산됩니다
          </p>
        ) : null}
      </Card>

      {result ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <span
            className={`inline-block rounded-md border px-2.5 py-1 text-xs font-bold ${LEVEL_STYLE[result.level].className}`}
          >
            {LEVEL_STYLE[result.level].label}
          </span>

          <div className="space-y-3">
            <h2 className="text-balance text-lg font-bold leading-snug">{result.headline}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{result.detail}</p>
          </div>

          <dl className="space-y-2.5 rounded-lg bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">내 앞에 있는 돈</dt>
              <dd className="font-semibold tabular-nums">{manwon(result.seniorTotalManwon)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">시세대로 팔릴 때</dt>
              <dd
                className={`font-semibold tabular-nums ${result.cushionManwon < 0 ? 'text-red-600' : ''}`}
              >
                {cushionLabel(result.cushionManwon)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">경매로 넘어갈 때</dt>
              <dd
                className={`font-semibold tabular-nums ${result.auctionCushionManwon < 0 ? 'text-red-600' : ''}`}
              >
                {cushionLabel(result.auctionCushionManwon)}
              </dd>
            </div>
          </dl>

          <CheckNextActions level={result.level} />

          <section className="space-y-3">
            <h3 className="text-sm font-bold">다음으로 확인하기</h3>
            <Link href={checkQuestionHref(result.level)} onClick={() => nextAction('ask')} className="block rounded-md bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground">
              등기부 내용을 질문하기
            </Link>
            <p className="text-xs text-muted-foreground">확인할 내용으로 질문 초안을 채웁니다. 금액은 자동으로 넣지 않으며 검토 후 직접 등록합니다.</p>
            <Link href="/contract-talk" onClick={() => nextAction('contract_talk')} className="block rounded-md border px-4 py-3 text-center text-sm font-semibold text-primary">
              집주인과 계약 전 확인하기
            </Link>
            <p className="text-xs text-muted-foreground">질문에 주소·건물명·개인정보를 적지 마세요. 입력한 금액은 전달되지 않습니다.</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold">함께 보면 좋은 글</h3>
            <ul className="space-y-2">
              {result.relatedGuides.map((g) => (
                <li key={g}>
                  <Link
                    href={depositGuidePath(g)}
                    onClick={() => nextAction('guide')}
                    className="block rounded-md border px-3 py-2.5 text-sm text-primary transition-colors hover:bg-muted/50"
                  >
                    {g}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <button
            onClick={reset}
            className="mx-auto block text-xs text-muted-foreground underline underline-offset-4"
          >
            다시 넣기
          </button>
        </Card>
      ) : null}

      <CheckCandidates input={result ? {
        marketPriceManwon: Number(price), depositManwon: Number(deposit),
        mortgageMaxManwon: Number(mortgage || 0), priorDepositsManwon: Number(prior || 0),
      } : null} onLoad={(input) => {
        setPrice(String(input.marketPriceManwon)); setDeposit(String(input.depositManwon))
        setMortgage(String(input.mortgageMaxManwon)); setPrior(String(input.priorDepositsManwon))
        setResult(calculateDepositRisk(input))
        document.getElementById('price')?.focus()
      }} />

      <ShareCheck />

      {/* 결과를 본 뒤에만 보여준다. 들어오자마자 권하면 아무도 안 누른다. */}
      {result ? <TesterInvite /> : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        이 계산은 넣으신 숫자만 가지고 하는 것입니다. 등기부에 적히지 않는 위험도 있으니 계약 전에는
        등기부를 직접 떼어 확인하세요. 판단이 서지 않으면{' '}
        <Link href="/community#ask" className="text-primary underline underline-offset-4">
          커뮤니티에 물어보셔도
        </Link>{' '}
        됩니다.
      </p>
    </div>
  )
}
