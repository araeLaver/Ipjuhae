'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  calculateHugEligibility,
  type HugCheckResult,
  type RegionType,
  type ValuationBasis,
} from '@/lib/hug-check'
import { manwon } from '@/lib/deposit-risk'
import { RegistryAlertCta } from '@/components/tools/registry-alert-cta'

const VERDICT_BADGE: Record<HugCheckResult['verdict'], { label: string; className: string }> = {
  likely: { label: '한도 안쪽 (가입 가능성 높음)', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  caution: { label: '조건부 확인 필요', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  ineligible: { label: '한도 초과 (가입 거절 위험)', className: 'bg-red-50 text-red-700 border-red-200' },
}

export function HugCheckCalculator() {
  const [basis, setBasis] = useState<ValuationBasis>('official_price')
  const [region, setRegion] = useState<RegionType>('metro')
  const [basePrice, setBasePrice] = useState('')
  const [deposit, setDeposit] = useState('')
  const [seniorDebt, setSeniorDebt] = useState('')
  const [result, setResult] = useState<HugCheckResult | null>(null)

  const ready = Number(basePrice) > 0 && Number(deposit) > 0

  function handleRun() {
    if (!ready) return
    setResult(
      calculateHugEligibility({
        basis,
        region,
        basePriceManwon: Number(basePrice),
        depositManwon: Number(deposit),
        seniorDebtManwon: Number(seniorDebt || 0),
      })
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header className="space-y-3">
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          무료 · 가입 없음 · 서버 저장 없음
        </span>
        <h1 className="text-balance text-2xl font-bold leading-snug sm:text-3xl">
          HUG 전세보증보험 126% 가입 가능 계산기
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          공시가격(126% 룰) 또는 KB시세·실거래가(90% 룰)와 선순위 채권을 넣어 전세보증보험
          한도 안쪽인지 10초 만에 확인하세요.
        </p>
      </header>

      <Card className="space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">주택가격 산정 기준</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={basis === 'official_price' ? 'default' : 'outline'}
              onClick={() => {
                setBasis('official_price')
                setResult(null)
              }}
            >
              공시가격 (빌라·오피스텔 126%)
            </Button>
            <Button
              type="button"
              variant={basis === 'market_price' ? 'default' : 'outline'}
              onClick={() => {
                setBasis('market_price')
                setResult(null)
              }}
            >
              KB시세·실거래가 (아파트 90%)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">지역</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={region === 'metro' ? 'default' : 'outline'}
              onClick={() => {
                setRegion('metro')
                setResult(null)
              }}
            >
              수도권 (보증금 7억 이하)
            </Button>
            <Button
              type="button"
              variant={region === 'non_metro' ? 'default' : 'outline'}
              onClick={() => {
                setRegion('non_metro')
                setResult(null)
              }}
            >
              비수도권 (보증금 5억 이하)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hug-base-price" className="text-sm font-semibold">
            {basis === 'official_price' ? '공동주택 공시가격 (만원)' : 'KB시세 또는 실거래가 (만원)'}
          </Label>
          <p className="text-xs text-muted-foreground">
            {basis === 'official_price'
              ? '부동산 공시가격 알리미에서 조회한 공시가격 (140% × 90% = 126% 적용)'
              : 'KB부동산 시세 하한가/일반평균가 또는 최근 실거래가 (90% 적용)'}
          </p>
          <div className="flex items-center gap-2">
            <Input
              id="hug-base-price"
              inputMode="numeric"
              value={basePrice}
              onChange={(e) => {
                setBasePrice(e.target.value.replace(/[^0-9]/g, ''))
                setResult(null)
              }}
              placeholder={basis === 'official_price' ? '20000' : '40000'}
              className="tabular-nums"
            />
            <span className="shrink-0 text-sm text-muted-foreground">만원</span>
          </div>
          {basePrice ? <p className="text-xs text-primary">{manwon(Number(basePrice))}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="hug-deposit" className="text-sm font-semibold">
            내 전세 보증금 (만원)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="hug-deposit"
              inputMode="numeric"
              value={deposit}
              onChange={(e) => {
                setDeposit(e.target.value.replace(/[^0-9]/g, ''))
                setResult(null)
              }}
              placeholder="25000"
              className="tabular-nums"
            />
            <span className="shrink-0 text-sm text-muted-foreground">만원</span>
          </div>
          {deposit ? <p className="text-xs text-primary">{manwon(Number(deposit))}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="hug-senior" className="text-sm font-semibold">
            선순위 채권 합계 (근저당 채권최고액 + 선순위 보증금)
          </Label>
          <p className="text-xs text-muted-foreground">없으면 0 또는 비워두세요</p>
          <div className="flex items-center gap-2">
            <Input
              id="hug-senior"
              inputMode="numeric"
              value={seniorDebt}
              onChange={(e) => {
                setSeniorDebt(e.target.value.replace(/[^0-9]/g, ''))
                setResult(null)
              }}
              placeholder="0"
              className="tabular-nums"
            />
            <span className="shrink-0 text-sm text-muted-foreground">만원</span>
          </div>
        </div>

        <Button type="button" size="lg" className="w-full" disabled={!ready} onClick={handleRun}>
          HUG 가입 가능성 계산하기
        </Button>
      </Card>

      {result ? (
        <Card className="space-y-5 p-5 sm:p-6">
          <span
            className={`inline-block rounded-md border px-2.5 py-1 text-xs font-bold ${VERDICT_BADGE[result.verdict].className}`}
          >
            {VERDICT_BADGE[result.verdict].label}
          </span>
          <h2 className="text-lg font-bold">{result.headline}</h2>

          <dl className="space-y-2.5 rounded-lg bg-muted/50 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">인정 주택가격</dt>
              <dd className="font-semibold tabular-nums">
                {manwon(result.recognizedHousePriceManwon)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">
                총 보증 한도 ({basis === 'official_price' ? '공시가격×126%' : '시세×90%'})
              </dt>
              <dd className="font-semibold tabular-nums">{manwon(result.maxTotalLimitManwon)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">안전 가입 가능 최대 보증금</dt>
              <dd className="font-bold text-primary tabular-nums">
                {manwon(result.maxEligibleDepositManwon)}
              </dd>
            </div>
            {result.officialPriceMultiple !== null ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">공시가격 대비 비율 (126% 기준)</dt>
                <dd
                  className={`font-semibold tabular-nums ${result.officialPriceMultiple > 1.26 ? 'text-red-600' : ''}`}
                >
                  {Math.round(result.officialPriceMultiple * 100)}%
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="space-y-2 text-sm">
            <h3 className="font-bold">판정 근거</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {result.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <h3 className="font-bold">계약 전 필수 행동</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {result.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 border-t pt-4 text-sm">
            <Link
              href="/tools/special-terms"
              className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground"
            >
              보증보험 특약 바로 생성하기
            </Link>
            <Link
              href="/check"
              className="rounded-md border px-4 py-2.5 font-semibold text-primary"
            >
              경매 위험·후보 집 비교하러 가기
            </Link>
          </div>
        </Card>
      ) : null}

      {result ? <RegistryAlertCta sourceTag="hug_check" /> : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        본 계산은 HUG 전세보증금반환보증의 일반 금액 기준(공시가격 126%, 시세 90%, 선순위 60%)을
        참고한 시뮬레이션이며 실제 가입 가능 여부는 주택유형·위반건축물·임대인 요건에 따라 HUG
        심사에서 최종 확정됩니다.
      </p>
    </div>
  )
}
