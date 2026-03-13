'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CheckCircle, MapPin, Mail, Sparkles } from 'lucide-react'

const KOREAN_CITIES = [
  '서울', '부산', '인천', '대구', '대전', '광주', '울산', '세종',
  '수원', '고양', '용인', '창원', '성남', '청주', '부천', '남양주',
  '전주', '화성', '안산', '천안', '안양', '포항', '의정부', '기타',
]

type FormStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate'

export function EarlyAccessForm() {
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !city || status === 'loading') return

    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), city }),
      })

      const data = (await res.json()) as { message?: string; error?: string }

      if (res.status === 409) {
        setStatus('duplicate')
        return
      }

      if (!res.ok) {
        setStatus('error')
        setErrorMessage(data.error ?? '오류가 발생했습니다')
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const handleReset = () => {
    setEmail('')
    setCity('')
    setStatus('idle')
    setErrorMessage('')
  }

  return (
    <section
      id="early-access"
      className="py-20 bg-gradient-to-br from-primary/5 via-emerald-50/60 to-white dark:from-background dark:via-background dark:to-background"
    >
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-xl mx-auto text-center"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            얼리액세스 신청
          </div>

          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            가장 먼저 경험하세요
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            얼리액세스 신청자에게{' '}
            <span className="text-primary font-medium">6개월 프리미엄 무료</span>와{' '}
            우선 입주 매칭 혜택을 드립니다.
          </p>

          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mt-10 flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-500" />
                </div>
                <p className="text-xl font-bold text-foreground">신청 완료!</p>
                <p className="text-muted-foreground text-base leading-relaxed">
                  얼리액세스 신청이 완료되었습니다.
                  <br />
                  서비스 출시 시 가장 먼저 알림을 보내드릴게요.
                </p>
                <button
                  onClick={handleReset}
                  className="mt-2 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                  다른 이메일로 신청하기
                </button>
              </motion.div>
            ) : status === 'duplicate' ? (
              <motion.div
                key="duplicate"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="mt-10 flex flex-col items-center gap-4"
              >
                <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-amber-500" />
                </div>
                <p className="text-xl font-bold text-foreground">이미 신청하셨네요!</p>
                <p className="text-muted-foreground">
                  해당 이메일은 이미 얼리액세스 신청이 완료되어 있어요.
                  <br />
                  출시 시 가장 먼저 연락드릴게요.
                </p>
                <button
                  onClick={handleReset}
                  className="mt-2 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                  다른 이메일로 신청하기
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="mt-10 flex flex-col gap-3"
              >
                {/* Email input */}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (status === 'error') setStatus('idle')
                    }}
                    placeholder="이메일 주소를 입력하세요"
                    required
                    disabled={status === 'loading'}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-white dark:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm disabled:opacity-50"
                  />
                </div>

                {/* City select */}
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-white dark:bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm disabled:opacity-50 appearance-none cursor-pointer"
                  >
                    <option value="" disabled>
                      희망 지역을 선택하세요
                    </option>
                    {KOREAN_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  size="lg"
                  loading={status === 'loading'}
                  disabled={status === 'loading' || !email.trim() || !city}
                  className="w-full mt-1"
                >
                  {status === 'loading' ? '신청 중...' : '얼리액세스 신청하기'}
                </Button>

                {/* Error message */}
                <AnimatePresence>
                  {status === 'error' && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-destructive text-center"
                    >
                      {errorMessage}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Disclaimer */}
          {(status === 'idle' || status === 'error' || status === 'loading') && (
            <p className="mt-4 text-xs text-muted-foreground">
              스팸 메일은 절대 보내지 않습니다. 언제든지 수신 거부 가능합니다.
            </p>
          )}
        </motion.div>
      </div>
    </section>
  )
}
