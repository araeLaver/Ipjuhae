'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Header } from '@/components/layout/header'
import { TermsConsent } from '@/components/auth/terms-consent'
import { User, Building } from 'lucide-react'
import { toast } from 'sonner'

function SocialSignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const provider = searchParams.get('provider') || ''
  const providerId = searchParams.get('providerId') || ''
  const email = searchParams.get('email') || ''
  const name = searchParams.get('name') || ''
  const profileImage = searchParams.get('profileImage') || ''

  const [isLoading, setIsLoading] = useState(false)
  const [userType, setUserType] = useState<'tenant' | 'landlord'>('tenant')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [marketingAgreed, setMarketingAgreed] = useState(false)

  const providerNames: Record<string, string> = {
    kakao: '카카오',
    naver: '네이버',
    google: '구글',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!termsAgreed || !privacyAgreed) {
      toast.error('필수 약관에 동의해주세요')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          providerId,
          email,
          name,
          profileImage,
          userType,
          termsAgreed,
          privacyAgreed,
          marketingAgreed,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '회원가입에 실패했습니다')
      }

      toast.success('회원가입이 완료되었습니다!')

      if (userType === 'landlord') {
        router.push('/landlord/onboarding')
      } else {
        router.push('/onboarding/basic')
      }
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">회원가입 완료</CardTitle>
        <CardDescription>
          {providerNames[provider] || provider} 계정으로 가입합니다
          {name && <span className="block mt-1 font-medium text-foreground">{name}</span>}
          {email && <span className="block text-xs">{email}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <Label>회원 유형</Label>
            <RadioGroup
              value={userType}
              onValueChange={(v) => setUserType(v as 'tenant' | 'landlord')}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="tenant" id="tenant" className="peer sr-only" />
                <Label
                  htmlFor="tenant"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/10 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                >
                  <User className="mb-3 h-6 w-6" />
                  <span className="font-medium">세입자</span>
                  <span className="text-xs text-muted-foreground">집을 구하고 있어요</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="landlord" id="landlord" className="peer sr-only" />
                <Label
                  htmlFor="landlord"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/10 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                >
                  <Building className="mb-3 h-6 w-6" />
                  <span className="font-medium">집주인</span>
                  <span className="text-xs text-muted-foreground">세입자를 찾고 있어요</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <TermsConsent
            termsAgreed={termsAgreed}
            privacyAgreed={privacyAgreed}
            marketingAgreed={marketingAgreed}
            onTermsChange={setTermsAgreed}
            onPrivacyChange={setPrivacyAgreed}
            onMarketingChange={setMarketingAgreed}
          />

          <Button type="submit" className="w-full" loading={isLoading}>
            가입 완료
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function SocialSignupPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4 animate-fade-in">
        <Suspense fallback={<div className="text-muted-foreground">로딩 중...</div>}>
          <SocialSignupForm />
        </Suspense>
      </main>
    </div>
  )
}
