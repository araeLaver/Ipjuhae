'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { PhoneVerification } from '@/components/auth/phone-verification'
import { toast } from 'sonner'

export default function VerifyPhonePage() {
  const router = useRouter()

  const handleVerified = () => {
    toast.success('휴대폰 인증이 완료되었습니다')
    router.push('/profile')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4 animate-fade-in">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">휴대폰 인증</CardTitle>
            <CardDescription>
              본인 확인을 위해 휴대폰 번호를 인증해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhoneVerification onVerified={handleVerified} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
