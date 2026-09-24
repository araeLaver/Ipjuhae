'use client'

/**
 * 실거래가로 시세 채우기.
 *
 * `/check`에서 제일 막히는 곳이 "매매 시세"다. 네이버 부동산을 따로 열어
 * 숫자를 찾아 와야 했다. 여기서 국토부 신고 거래를 보여주고 고르게 한다.
 *
 * **우리가 시세를 정해 주지 않는다.** 실제 거래 목록을 보여줄 뿐이고
 * 어느 거래가 내 집과 비슷한지는 사용자가 판단한다. 그래서 면적·층·날짜를
 * 다 보여준다. 하나만 골라 "시세입니다"라고 말하면 그 순간 추정이 된다.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { manwon } from '@/lib/deposit-risk'

interface Trade {
  name: string
  areaM2: number
  priceManwon: number
  floor: number
  dealtAt: string
  dong: string
  buildYear: number
}

interface Props {
  onPick: (priceManwon: number) => void
}

/**
 * 다음 우편번호 SDK의 전역 타입은 `components/ui/address-search.tsx`가
 * 이미 `any`로 선언해 두었다. 여기서 다시 선언하면 충돌한다.
 * 필요한 모양만 지역 타입으로 두고 호출 지점에서 좁힌다.
 */
interface DaumPostcodeResult {
  bcode?: string
  sido?: string
  sigungu?: string
}

interface DaumPostcodeSdk {
  Postcode: new (opts: { oncomplete: (data: DaumPostcodeResult) => void }) => {
    open: () => void
  }
}

function daumSdk(): DaumPostcodeSdk | undefined {
  return (window as unknown as { daum?: DaumPostcodeSdk }).daum
}

const SCRIPT_SRC = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

export function MarketPricePicker({ onPick }: Props) {
  const [region, setRegion] = useState<{ lawdCd: string; label: string } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [trades, setTrades] = useState<Trade[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * 다음 우편번호에서 법정동코드(bcode)를 받는다. 앞 5자리가 실거래가 조회 코드다.
   * 별도 코드표를 들고 다닐 필요가 없다.
   */
  function openPostcode() {
    setError(null)
    const open = () => {
      const sdk = daumSdk()
      if (!sdk?.Postcode) {
        setError('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요')
        return
      }
      new sdk.Postcode({
        oncomplete: (data) => {
          const code = (data.bcode ?? '').slice(0, 5)
          if (!/^\d{5}$/.test(code)) {
            setError('이 주소로는 지역 코드를 찾지 못했습니다')
            return
          }
          setRegion({ lawdCd: code, label: `${data.sido ?? ''} ${data.sigungu ?? ''}`.trim() })
          setTrades(null)
        },
      }).open()
    }

    if (daumSdk()?.Postcode) {
      open()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.onload = open
    script.onerror = () => setError('주소 검색을 불러오지 못했습니다')
    document.body.appendChild(script)
  }

  async function search() {
    if (!region) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ lawdCd: region.lawdCd })
      if (keyword.trim()) params.set('keyword', keyword.trim())
      const res = await fetch(`/api/market-price?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '조회에 실패했습니다')
      setTrades(json.trades ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회에 실패했습니다')
      setTrades(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4 border-dashed p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">시세를 찾기 어려우시면</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          국토교통부에 신고된 실제 거래를 보여드립니다. 내 집과 비슷한 거래를 고르시면 위 칸이
          채워집니다.
        </p>
      </div>

      <div className="space-y-2">
        <Button type="button" variant="outline" onClick={openPostcode} className="w-full">
          {region ? `${region.label} 다시 고르기` : '주소로 지역 찾기'}
        </Button>

        {region ? (
          <div className="space-y-2">
            <Label htmlFor="apt-keyword" className="text-xs">
              단지 이름 (선택)
            </Label>
            <div className="flex gap-2">
              <Input
                id="apt-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') search()
                }}
                placeholder="예: 래미안"
              />
              <Button type="button" onClick={search} disabled={loading}>
                {loading ? '찾는 중' : '찾기'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {trades && trades.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          최근 6개월 안에 신고된 거래가 없습니다. 단지 이름을 지우고 다시 찾아보시거나, 시세를
          직접 넣어주세요.
        </p>
      ) : null}

      {trades && trades.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            비슷한 면적의 거래를 고르세요. 면적이 다르면 값이 크게 달라집니다.
          </p>
          <ul className="max-h-72 space-y-1.5 overflow-y-auto">
            {trades.map((t, i) => (
              <li key={`${t.name}-${t.dealtAt}-${i}`}>
                <button
                  type="button"
                  onClick={() => onPick(t.priceManwon)}
                  className="w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{t.name}</span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                      {manwon(t.priceManwon)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {t.areaM2}㎡ · {t.floor}층 · {t.dealtAt}
                    {t.buildYear ? ` · ${t.buildYear}년 준공` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">출처: 국토교통부 실거래가</p>
        </div>
      ) : null}
    </Card>
  )
}
