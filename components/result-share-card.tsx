'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cushionLabel, manwon, type DepositRiskResult, type RiskLevel } from '@/lib/deposit-risk'
import { buildSpecialTerms } from '@/lib/special-terms'
import type { RegistryFlag } from '@/lib/registry-parser'
import { RegistryAlertCta } from '@/components/tools/registry-alert-cta'

interface ResultShareCardProps {
  result: DepositRiskResult
  mortgageMaxManwon: number
  priorDepositsManwon: number
  registryFlags?: RegistryFlag[]
}

const BADGE_META: Record<RiskLevel, { label: string; bg: string; fg: string; accent: string }> = {
  safe: { label: '여유 있음', bg: '#ECFDF5', fg: '#047857', accent: '#10B981' },
  caution: { label: '주의 필요', bg: '#FFFBEB', fg: '#B45309', accent: '#F59E0B' },
  danger: { label: '계약 위험', bg: '#FEF2F2', fg: '#B91C1C', accent: '#EF4444' },
  critical: { label: '매우 위험', bg: '#FEF2F2', fg: '#991B1B', accent: '#DC2626' },
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

async function generateReportCardBlob(
  result: DepositRiskResult,
  topTerms: string[],
  flagLabels: string[]
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const meta = BADGE_META[result.level]
  const pct = Number.isFinite(result.burdenRatio) ? Math.round(result.burdenRatio * 100) : 0

  // 배경
  ctx.fillStyle = '#FBF6EF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 메인 카드
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(64, 64, 952, 1222, 36)
  ctx.fill()

  // 상단 포인트 바
  ctx.fillStyle = meta.accent
  ctx.beginPath()
  ctx.roundRect(64, 64, 952, 18, [36, 36, 0, 0])
  ctx.fill()

  // 브랜드 헤더
  ctx.fillStyle = '#F0663F'
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('입주해 · 보증금 안전 진단 성적표', 120, 152)

  ctx.fillStyle = '#6B7280'
  ctx.font = '400 24px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('주소·개인정보 제외 요약본 (참고용)', 120, 194)

  // 등급 배지
  ctx.fillStyle = meta.bg
  ctx.beginPath()
  ctx.roundRect(120, 232, 240, 68, 16)
  ctx.fill()
  ctx.fillStyle = meta.fg
  ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText(meta.label, 156, 277)

  // 핵심 수치
  ctx.fillStyle = '#111827'
  ctx.font = '800 58px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText(`시세 대비 부담률 ${pct}%`, 120, 382)

  // 핵심 지표 박스
  ctx.fillStyle = '#F9FAFB'
  ctx.beginPath()
  ctx.roundRect(120, 424, 840, 224, 24)
  ctx.fill()

  const rows: Array<[string, string]> = [
    ['내 앞 선순위 금액', manwon(result.seniorTotalManwon)],
    ['시세대로 팔릴 때', cushionLabel(result.cushionManwon)],
    ['경매(70% 낙찰) 가정 시', cushionLabel(result.auctionCushionManwon)],
  ]
  rows.forEach(([k, v], i) => {
    const y = 486 + i * 64
    ctx.fillStyle = '#4B5563'
    ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
    ctx.fillText(k, 160, y)
    ctx.fillStyle = v.includes('부족') ? '#DC2626' : '#111827'
    ctx.font = '700 30px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
    const w = ctx.measureText(v).width
    ctx.fillText(v, 920 - w, y)
  })

  // 등기부 위험 신호 (있을 때만)
  let nextY = 710
  if (flagLabels.length > 0) {
    ctx.fillStyle = '#FEF2F2'
    ctx.beginPath()
    ctx.roundRect(120, 676, 840, 84, 18)
    ctx.fill()
    ctx.fillStyle = '#B91C1C'
    ctx.font = '700 26px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
    ctx.fillText(`등기부 위험 신호 감지: ${flagLabels.join(', ')}`, 154, 728)
    nextY = 816
  }

  // 이 집 필수 특약 3줄
  ctx.fillStyle = '#111827'
  ctx.font = '700 32px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('계약서에 꼭 넣어야 할 핵심 특약', 120, nextY)
  nextY += 48

  ctx.font = '500 26px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  topTerms.slice(0, 3).forEach((term, idx) => {
    const lines = wrapCanvasText(ctx, `${idx + 1}. ${term}`, 820)
    ctx.fillStyle = '#374151'
    lines.slice(0, 2).forEach((line) => {
      ctx.fillText(line, 128, nextY)
      nextY += 38
    })
    nextY += 16
  })

  // 하단 워터마크
  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(120, 1170)
  ctx.lineTo(960, 1170)
  ctx.stroke()

  ctx.fillStyle = '#F0663F'
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('무료 10초 보증금 안전 진단 · www.ipjuhae.com/check', 120, 1226)
  ctx.fillStyle = '#9CA3AF'
  ctx.font = '400 21px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif'
  ctx.fillText('입력한 금액 기준 참고 결과이며 보증 가입 및 안전을 확정하지 않습니다.', 120, 1260)

  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

export function ResultShareCard({
  result,
  mortgageMaxManwon,
  priorDepositsManwon,
  registryFlags = [],
}: ResultShareCardProps) {
  const [notice, setNotice] = useState('')
  const [savingCard, setSavingCard] = useState(false)

  const termsBundle = buildSpecialTerms({
    hasMortgage: mortgageMaxManwon > 0,
    hasPriorTenants: priorDepositsManwon > 0,
    needsJeonseLoan: true,
    needsInsurance: true,
    hasPet: false,
    needsRepairCheck: false,
  })

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(`${label}을(를) 복사했습니다. 카톡이나 메모장에 바로 붙여넣으세요.`)
    } catch {
      setNotice('클립보드 복사를 지원하지 않는 환경입니다. 아래 특약 생성기에서 복사해 주세요.')
    }
  }

  async function handleShareCard() {
    setSavingCard(true)
    setNotice('')
    try {
      const blob = await generateReportCardBlob(
        result,
        termsBundle.items.map((i) => i.title),
        registryFlags.map((f) => f.label)
      )
      if (!blob) {
        setNotice('진단 카드를 생성하지 못했습니다.')
        return
      }
      const file = new File([blob], 'ipjuhae-deposit-report.png', { type: 'image/png' })
      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: '입주해 보증금 안전 진단 성적표',
          text: '이 집 계약 전 보증금 안전 진단 결과입니다. www.ipjuhae.com/check',
          files: [file],
        })
        setNotice('진단 성적표 카드를 공유했습니다.')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ipjuhae-deposit-report.png'
      a.click()
      URL.revokeObjectURL(url)
      setNotice('진단 성적표 카드(PNG)를 저장했습니다. 부모님·단톡방에 이미지로 공유해 보세요!')
    } catch {
      setNotice('공유가 취소되었거나 지원되지 않습니다.')
    } finally {
      setSavingCard(false)
    }
  }

  return (
    <section
      className="space-y-4 rounded-lg border border-primary/25 bg-primary/5 p-4"
      aria-label="맞춤 특약 및 성적표 공유"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-bold">이 집에 꼭 넣어야 할 맞춤 특약 ({termsBundle.items.length}개)</h3>
        <p className="text-xs text-muted-foreground">
          지금 입력하신 근저당·선순위 조건에 맞춰 계약서 필수 특약과 중개사 요청 문자를 바로 만들었습니다.
        </p>
      </div>

      <ul className="space-y-2 text-xs">
        {termsBundle.items.slice(0, 3).map((item) => (
          <li key={item.id} className="rounded-md border bg-background p-2.5">
            <p className="font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">{item.clause}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copyText(termsBundle.contractText, '계약서 맞춤 특약 전체')}
        >
          계약서 특약 전체 복사
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void copyText(termsBundle.politeMessage, '중개사·집주인 요청 카톡 문자')}
        >
          중개사 요청 카톡 문자 복사
        </Button>
      </div>

      <div className="border-t border-primary/15 pt-3 space-y-2">
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={savingCard}
          onClick={() => void handleShareCard()}
        >
          {savingCard
            ? '성적표 카드 만드는 중…'
            : '부모님·친구에게 물어보기 (진단 성적표 카드 저장/공유)'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          주소와 개인정보 없이 위험 등급·부담률·핵심 특약만 1장 이미지로 만들어집니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-primary/15 pt-3 text-xs">
        <Link
          href="/tools/hug-check"
          className="font-semibold text-primary underline underline-offset-4"
        >
          HUG 보증보험 126% 정밀 계산기 →
        </Link>
        <Link
          href="/tools/special-terms"
          className="font-semibold text-primary underline underline-offset-4"
        >
          반려동물·수선 포함 특약 맞춤 생성기 →
        </Link>
      </div>

      {notice ? (
        <p role="status" className="text-xs font-medium text-primary">
          {notice}
        </p>
      ) : null}

      <RegistryAlertCta sourceTag="check_result" />
    </section>
  )
}
