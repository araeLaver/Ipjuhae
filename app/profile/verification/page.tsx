'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { VerificationCardWithUpload } from '@/components/verification/verification-card-with-upload'
import { PageContainer } from '@/components/layout/page-container'
import { Shield } from 'lucide-react'
import { Verification } from '@/types/database'
import { calculateTrustScore, getTrustScoreColor } from '@/lib/trust-score'
import { toast } from 'sonner'

export default function VerificationPage() {
  const router = useRouter()
  const [verification, setVerification] = useState<Verification | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerified = (updated: Verification) => {
    setVerification(updated)
    toast.success('인증이 완료되었습니다!')
  }

  const scoreBreakdown = calculateTrustScore({ verification })
  const verificationScore = scoreBreakdown.employment + scoreBreakdown.income + scoreBreakdown.credit

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">인증 관리</h1>
          <p className="text-muted-foreground">인증을 완료하여 신뢰점수를 높여보세요</p>
        </div>

        <Card className="shadow-card">
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

        <div className="space-y-4">
          <VerificationCardWithUpload
            type="employment"
            verification={verification}
            onVerified={handleVerified}
          />
          <VerificationCardWithUpload
            type="income"
            verification={verification}
            onVerified={handleVerified}
          />
          <VerificationCardWithUpload
            type="credit"
            verification={verification}
            onVerified={handleVerified}
          />
        </div>

        <div className="text-sm text-muted-foreground text-center">
          <p>* 이 데모에서는 실제 인증 없이 Mock 데이터를 사용합니다.</p>
        </div>
      </div>
    </PageContainer>
  )
}
