'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Mail, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { SocialLoginButtons } from '@/components/auth/social-login-buttons'
import { createBrowserClient } from '@/lib/supabase'

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: '인증 코드가 없습니다. 다시 시도해주세요.',
  auth_failed: '인증에 실패했습니다. 매직 링크가 만료되었을 수 있습니다.',
  server_error: '서버 오류가 발생했습니다. 다시 시도해주세요.',
  oauth_denied: '소셜 로그인이 취소되었습니다.',
  oauth_failed: '소셜 로그인 중 오류가 발생했습니다. 다시 시도해주세요.',
  invalid_provider: '지원하지 않는 로그인 방식입니다.',
  email_exists: '이미 이메일로 가입된 계정이 있습니다. 이메일로 로그인해주세요.',
  state_mismatch: '보안 검증에 실패했습니다. 다시 시도해주세요.',
}

const RESEND_COOLDOWN_SEC = 60

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLinkSent, setIsMagicLinkSent] = useState(false)
  const [mode, setMode] = useState<'password' | 'magic'>('magic')
  const [cooldown, setCooldown] = useState(0)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    const error = searchParams.get('error')
    if (error && ERROR_MESSAGES[error]) {
      toast.error(ERROR_MESSAGES[error])
    }
  }, [searchParams])

  const sendMagicLink = useCallback(async (email: string) => {
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }, [])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email) {
      toast.error('이메일을 입력해주세요')
      return
    }
    setIsLoading(true)

    try {
      await sendMagicLink(formData.email)
      setIsMagicLinkSent(true)
      setCooldown(RESEND_COOLDOWN_SEC)
      toast.success('매직 링크가 이메일로 전송되었습니다!')
    } catch (err) {
      toast.error((err as Error).message || '매직 링크 전송에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0 || isLoading) return
    setIsLoading(true)
    try {
      await sendMagicLink(formData.email)
      setCooldown(RESEND_COOLDOWN_SEC)
      toast.success('매직 링크를 다시 보냈습니다!')
    } catch (err) {
      toast.error((err as Error).message || '재전송에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '로그인에 실패했습니다')
      }

      toast.success('로그인 성공!')
      const userType = data.user?.user_type
      if (userType === 'landlord') {
        router.push('/landlord')
      } else if (userType === 'admin') {
        router.push('/admin')
      } else {
        router.push('/profile')
      }
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isMagicLinkSent) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md shadow-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">이메일을 확인하세요</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{formData.email}</span>
                <br />
                로 매직 링크를 보냈습니다. 이메일의 링크를 클릭하여 로그인하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="default"
                className="w-full"
                onClick={handleResend}
                disabled={cooldown > 0 || isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {cooldown > 0
                  ? `${cooldown}초 후 재전송 가능`
                  : '매직 링크 다시 보내기'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsMagicLinkSent(false)
                  setCooldown(0)
                }}
              >
                다른 이메일로 시도
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 animate-fade-in">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">로그인</CardTitle>
            <CardDescription>
              {mode === 'magic'
                ? '이메일로 매직 링크를 받아 간편하게 로그인하세요'
                : '이메일과 비밀번호로 로그인하세요'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'magic' ? (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="example@email.com"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" loading={isLoading}>
                  <Mail className="mr-2 h-4 w-4" />
                  매직 링크 전송
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">또는</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setMode('password')}
                >
                  비밀번호로 로그인
                </Button>

                <SocialLoginButtons mode="login" />

                <p className="text-center text-sm text-muted-foreground">
                  계정이 없으신가요?{' '}
                  <Link href="/signup" className="text-primary hover:underline">
                    회원가입
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="example@email.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="비밀번호 입력"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" loading={isLoading}>
                  로그인
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">또는</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setMode('magic')}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  매직 링크로 로그인
                </Button>

                <SocialLoginButtons mode="login" />

                <p className="text-center text-sm text-muted-foreground">
                  계정이 없으신가요?{' '}
                  <Link href="/signup" className="text-primary hover:underline">
                    회원가입
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
