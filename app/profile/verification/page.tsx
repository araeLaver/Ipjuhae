'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VerificationCard } from '@/components/verification/verification-card'
import { Home, ArrowLeft, Shield, Loader2 } from 'lucide-react'
import { Verification } from '@/types/database'
import { calculateTrustScore, getTrustScoreLabel, getTrustScoreColor } from '@/lib/trust-score'

export default function VerificationPage() {
  const router = useRouter()
  const [verification, setVerification] = useState<Verification | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchVerification()
  }, [])

  const fetchVerification = async () => {
    try {
      const response = await fetch('/api/verifications')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(data.error)
      }

      setVerification(data.verification)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerified = (updated: Verification) => {
    setVerification(updated)
  }

  // 인증 점수 계산
  const scoreBreakdown = calculateTrustScore({ verification })
  const verificationScore = scoreBreakdown.employment + scoreBreakdown.income + scoreBreakdown.credit

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">인증 관리</h1>
            <p className="text-muted-foreground">인증을 완료하여 신뢰점수를 높여보세요</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* 인증 점수 요약 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>인증 점수</CardTitle>
                  <CardDescription>인증을 통해 획득한 점수</CardDescription>
                </div>
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full ${getTrustScoreColor(verificationScore)} flex items-center justify-center`}>
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-bold mt-1">{verificationScore}점</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-muted-foreground">재직</p>
                  <p className="font-semibold">{scoreBreakdown.employment}점</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">소득</p>
                  <p className="font-semibold">{scoreBreakdown.income}점</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">신용</p>
                  <p className="font-semibold">{scoreBreakdown.credit}점</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 인증 카드들 */}
          <div className="space-y-4">
            <VerificationCard
              type="employment"
              verification={verification}
              onVerified={handleVerified}
            />
            <VerificationCard
              type="income"
              verification={verification}
              onVerified={handleVerified}
            />
            <VerificationCard
              type="credit"
              verification={verification}
              onVerified={handleVerified}
            />
          </div>

          <div className="text-sm text-muted-foreground text-center">
            <p>* 이 데모에서는 실제 인증 없이 Mock 데이터를 사용합니다.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
