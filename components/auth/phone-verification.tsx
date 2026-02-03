'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface PhoneVerificationProps {
  onVerified: (phoneNumber: string) => void
}

export function PhoneVerification({ onVerified }: PhoneVerificationProps) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [timer, setTimer] = useState(0)

  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  const formatPhone = (value: string) => {
    const nums = value.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 3) return nums
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`
  }

  const handleSend = async () => {
    const raw = phone.replace(/-/g, '')
    if (raw.length < 10) {
      toast.error('올바른 휴대폰 번호를 입력해주세요')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/auth/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: raw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSent(true)
      setTimer(180)
      toast.success('인증번호가 발송되었습니다')
      if (data.code) {
        toast.info(`[테스트] 인증번호: ${data.code}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('6자리 인증번호를 입력해주세요')
      return
    }

    setVerifying(true)
    try {
      const raw = phone.replace(/-/g, '')
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: raw, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('인증이 완료되었습니다')
      onVerified(raw)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  const minutes = Math.floor(timer / 60)
  const seconds = timer % 60

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>휴대폰 번호</Label>
        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-1234-5678"
            disabled={sent && timer > 0}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSend}
            loading={sending}
            disabled={sent && timer > 0}
            className="shrink-0"
          >
            {sent ? '재발송' : '인증요청'}
          </Button>
        </div>
      </div>

      {sent && (
        <div className="space-y-2">
          <Label>인증번호</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6자리 입력"
                maxLength={6}
              />
              {timer > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-destructive">
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </span>
              )}
            </div>
            <Button
              type="button"
              onClick={handleVerify}
              loading={verifying}
              disabled={timer <= 0}
              className="shrink-0"
            >
              확인
            </Button>
          </div>
          {timer <= 0 && sent && (
            <p className="text-xs text-destructive">인증 시간이 만료되었습니다. 다시 요청해주세요.</p>
          )}
        </div>
      )}
    </div>
  )
}
