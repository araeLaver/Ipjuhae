'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CheckCircle, Users, Mail } from 'lucide-react'

type UserType = 'tenant' | 'landlord'

export function WaitlistSection() {
  const [userType, setUserType] = useState<UserType>('tenant')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'duplicate'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/waitlist')
      .then((res) => res.json())
      .then((data: { count: number }) => setCount(data.count))
      .catch(() => setCount(null))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || status === 'loading') return

    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), user_type: userType }),
      })

      const data = (await res.json()) as { message?: string; error?: string; count?: number }

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
      if (data.count !== undefined) setCount(data.count)
    } catch {
      setStatus('error')
      setErrorMessage('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <section className="py-20 bg-gradient-to-br from-teal-50 via-emerald-50/40 to-white dark:from-background dark:via-background dark:to-background">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto text-center"
        >
          {/* 헤더 */}
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Mail className="w-4 h-4" />
            사전 신청
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            서비스 출시 알림 신청
          </h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            임주해 서비스 출시 시 가장 먼저 알림을 받으세요.
            <br />
            <span className="text-primary font-medium">사전 신청자에게 3개월 프리미엄 무료 혜택</span>을 드립니다.
          </p>

          {/* 신청자 수 카운터 */}
          {count !== null && count > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Users className="w-4 h-4 text-primary" />
              <span>현재 <strong className="text-foreground">{count.toLocaleString()}명</strong>이 대기 중입니다</span>
            </motion.div>
          )}

          {/* 탭 */}
          <div className="mt-8 inline-flex rounded-xl border border-border bg-muted/50 p-1">
            <button
              onClick={() => { setUserType('tenant'); setStatus('idle') }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                userType === 'tenant'
                  ? 'bg-white dark:bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              세입자
            </button>
            <button
              onClick={() => { setUserType('landlord'); setStatus('idle') }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                userType === 'landlord'
                  ? 'bg-white dark:bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              집주인
            </button>
          </div>

          {/* 폼 */}
          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-lg font-semibold text-foreground">신청 완료!</p>
                <p className="text-muted-foreground">출시 시 이메일로 알림드릴게요. 😊</p>
                {count !== null && (
                  <p className="text-sm text-muted-foreground">
                    현재 <strong className="text-foreground">{count.toLocaleString()}명</strong>이 기다리고 있습니다
                  </p>
                )}
              </motion.div>
            ) : status === 'duplicate' ? (
              <motion.div
                key="duplicate"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-amber-500" />
                </div>
                <p className="text-lg font-semibold text-foreground">이미 신청하셨네요!</p>
                <p className="text-muted-foreground">출시 시 이메일로 알림드릴게요. 기다려주세요 😊</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
                  placeholder="이메일 주소를 입력하세요"
                  required
                  disabled={status === 'loading'}
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-white dark:bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={status === 'loading' || !email.trim()}
                  className="whitespace-nowrap"
                >
                  {status === 'loading' ? '신청 중...' : '출시 알림 받기'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* 에러 메시지 */}
          {status === 'error' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-sm text-destructive"
            >
              {errorMessage}
            </motion.p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            스팸 메일은 절대 보내지 않습니다. 언제든지 수신 거부 가능합니다.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
