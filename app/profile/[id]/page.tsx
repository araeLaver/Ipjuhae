'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ProfileCard } from '@/components/profile/profile-card'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Header } from '@/components/layout/header'
import { Home, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Profile, Verification } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'

export default function PublicProfilePage() {
  const params = useParams()
  const id = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch(`/api/profile/${id}`)
        if (!response.ok) {
          setError(true)
          return
        }
        const data = await response.json()
        setProfile(data.profile)
        setVerification(data.verification || null)
      } catch (err) {
        console.error('Failed to load profile:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-md animate-fade-in">
          <div className="space-y-6">
            <Skeleton className="h-6 w-32 mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<AlertCircle className="h-12 w-12" />}
            title="프로필을 찾을 수 없습니다"
            description="존재하지 않거나 공개되지 않은 프로필입니다."
            action={{ label: '홈으로 돌아가기', onClick: () => window.location.href = '/' }}
          />
        </main>
      </div>
    )
  }

  const scoreBreakdown = calculateTrustScore({ profile, verification })

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-md animate-fade-in">
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">세입자 프로필</p>
            <h1 className="text-2xl font-bold">{profile.name}님의 프로필</h1>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">신뢰점수</CardTitle>
            </CardHeader>
            <CardContent>
              <TrustScoreChart
                total={scoreBreakdown.total}
                breakdown={scoreBreakdown}
              />
            </CardContent>
          </Card>

          <ProfileCard profile={profile} verification={verification} />

          <div className="bg-primary/5 p-4 rounded-lg text-center border border-primary/10">
            <p className="text-sm text-primary/80">
              이 프로필은{' '}
              <Link href="/" className="font-semibold underline">
                입주해
              </Link>
              에서 생성되었습니다.
            </p>
            <p className="text-xs text-primary/60 mt-1">
              신뢰할 수 있는 세입자 프로필을 만들어보세요.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
