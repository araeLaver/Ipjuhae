'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface RegistryAlertCtaProps {
  /** Attribution tag saved in waitlist.utm_source (e.g. 'check_result', 'hug_check', 'special_terms') */
  sourceTag: string
  /** Optional custom heading */
  title?: string
  /** Optional custom subtitle */
  description?: string
}

const USER_TYPES: Array<{ value: 'tenant' | 'landlord' | 'broker'; label: string }> = [
  { value: 'tenant', label: '임차인(세입자)' },
  { value: 'landlord', label: '임대인(집주인)' },
  { value: 'broker', label: '공인중개사' },
]

/**
 * 무료 보증금·HUG·특약 도구 결과 하단에 배치하는 전환 훅.
 * 기존 POST /api/waitlist에 유입 경로(utm_source/medium/campaign)와 함께 기록하여
 * 잔금일까지 등기 변동 알림 · Trust Card 정밀 리포트 베타 수요를 실제 데이터로 수집한다.
 */
export function RegistryAlertCta({
  sourceTag,
  title = '잔금일까지 등기부 변동 알림 · Trust Card 정밀 리포트',
  description = '계약 직전 근저당 추가·가압류 변동을 자동 감지하고, 원본 대신 최소 사실만 공유하는 Trust Card 정식 오픈 알림을 가장 먼저 받아보세요.',
}: RegistryAlertCtaProps) {
  const [email, setEmail] = useState('')
  const [userType, setUserType] = useState<'tenant' | 'landlord' | 'broker'>('tenant')
  const [consent, setConsent] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('이메일을 입력해 주세요.')
      return
    }
    if (!consent) {
      setError('개인정보 수집·이용에 동의해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          user_type: userType,
          consent: true,
          utm_source: sourceTag,
          utm_medium: 'tool_result_cta',
          utm_campaign: 'registry_alert_beta',
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409) {
        setDoneMessage('이미 사전 알림 신청이 완료된 이메일입니다. 오픈 시 가장 먼저 안내해 드릴게요.')
        return
      }
      if (!res.ok) {
        setError(data?.error ?? '신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      const countText =
        typeof data?.count === 'number' && data.count > 0
          ? ` (현재 ${data.count.toLocaleString('ko-KR')}명 대기 중)`
          : ''
      setDoneMessage(`사전 알림 신청이 완료되었습니다${countText}. 정식 오픈 시 무료 베타 혜택을 안내해 드립니다.`)
      setEmail('')
    } catch {
      setError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      aria-label="등기부 변동 알림 및 정밀 리포트 사전 신청"
      className="rounded-2xl border border-[#18342E]/20 bg-[#18342E] p-5 text-[#FBF6EF] shadow-sm"
    >
      <p className="text-[11px] font-bold tracking-wider text-[#F4977B]">
        PATENT TRUST ENGINE · 무료 베타 사전 신청
      </p>
      <h3 className="mt-1.5 text-base font-bold leading-snug text-white">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-[#D9E6E0]">{description}</p>

      {doneMessage ? (
        <div
          role="status"
          className="mt-4 rounded-xl bg-white/10 p-3 text-xs font-semibold leading-relaxed text-emerald-200"
        >
          ✓ {doneMessage}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="사용자 유형">
            {USER_TYPES.map((item) => {
              const active = userType === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setUserType(item.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#F0663F] text-white'
                      : 'bg-white/10 text-[#E5EFEA] hover:bg-white/20'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="알림 받을 이메일 주소 (예: name@example.com)"
              aria-label="알림 받을 이메일 주소"
              disabled={submitting}
              className="h-10 flex-1 border-white/20 bg-white text-sm text-[#262220] placeholder:text-[#9A8F87]"
            />
            <Button
              type="submit"
              disabled={submitting}
              className="h-10 shrink-0 bg-[#F0663F] px-4 text-xs font-bold text-white hover:bg-[#d85530]"
            >
              {submitting ? '신청 중...' : '무료 베타 알림 받기'}
            </Button>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#C8DBD2]">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#F0663F]"
            />
            <span>출시 및 베타 알림 발송을 위한 이메일 수집·이용에 동의합니다.</span>
          </label>

          {error ? (
            <p role="alert" className="text-xs font-medium text-[#FCA5A5]">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  )
}
