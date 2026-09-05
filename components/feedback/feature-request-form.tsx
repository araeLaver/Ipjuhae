'use client'

import { useState } from 'react'

// 신청자·방문자가 원하는 기능을 남기는 소통창구.
// dark: 랜딩(네이비 배경)용, 기본: 미리보기(밝은 배경)용.
export function FeatureRequestForm({
  source,
  dark = false,
}: {
  source: 'preview' | 'landing'
  dark?: boolean
}) {
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const submit = async () => {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    setErrorMsg('')
    try {
      const res = await fetch('/api/feature-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), contact: contact.trim() || undefined, source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg((data as { error?: string }).error ?? '전송에 실패했습니다. 잠시 후 다시 시도해주세요.')
        setStatus('error')
        return
      }
      setStatus('done')
    } catch {
      setErrorMsg('전송에 실패했습니다. 잠시 후 다시 시도해주세요.')
      setStatus('error')
    }
  }

  const inputBase = dark
    ? 'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/50 focus:outline-none'
    : 'w-full rounded-lg border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40'

  if (status === 'done') {
    return (
      <div className={`rounded-2xl border p-6 text-center ${dark ? 'border-white/15 bg-white/5 text-white' : 'bg-background'}`}>
        <p className="text-lg font-bold">의견이 접수됐어요</p>
        <p className={`mt-1 text-sm ${dark ? 'text-white/70' : 'text-muted-foreground'}`}>
          보내주신 요구사항은 개발 우선순위에 바로 반영됩니다. 감사합니다!
        </p>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-6 ${dark ? 'border-white/15 bg-white/5 text-white' : 'bg-background'}`}>
      <p className="text-lg font-bold">이런 기능이 필요해요</p>
      <p className={`mt-1 text-sm ${dark ? 'text-white/70' : 'text-muted-foreground'}`}>
        원하는 기능이나 아쉬운 점을 알려주세요. 보내주신 의견이 개발 순서를 정합니다.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="예) 월세 자동이체 연동이 있으면 좋겠어요 / 집주인 후기도 보고 싶어요"
        className={`${inputBase} mt-4 resize-none`}
        aria-label="원하는 기능"
      />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={100}
          placeholder="연락처 (선택 — 답변받고 싶을 때만)"
          className={inputBase}
          aria-label="연락처 (선택)"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!message.trim() || status === 'sending'}
          className="shrink-0 rounded-lg px-6 py-3 text-sm font-bold text-white transition disabled:opacity-50"
          style={{ backgroundColor: '#F0663F' }}
        >
          {status === 'sending' ? '보내는 중…' : '의견 보내기'}
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-sm text-red-400">{errorMsg}</p>}
    </div>
  )
}
