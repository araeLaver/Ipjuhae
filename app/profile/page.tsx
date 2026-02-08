'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileCard } from '@/components/profile/profile-card'
import { ShareButton } from '@/components/profile/share-button'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { ProfileImageUpload } from '@/components/profile/profile-image-upload'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer } from '@/components/layout/page-container'
import { Edit, Shield, Users } from 'lucide-react'
import { AccountStatus } from '@/components/profile/account-status'
import Link from 'next/link'
import { Profile, Verification } from '@/types/database'
import { calculateTrustScore } from '@/lib/trust-score'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile')
        if (response.status === 401) {
          router.push('/login')
          return
        }
        const data = await response.json()

        if (!data.profile || !data.profile.is_complete) {
          router.push('/onboarding/basic')
          return
        }

        setProfile(data.profile)
        setVerification(data.verification || null)
        setProfileImage(data.profileImage || null)
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  if (loading) {
    return (
      <PageContainer maxWidth="sm">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </PageContainer>
    )
  }

  if (!profile) return null

  const scoreBreakdown = calculateTrustScore({ profile, verification })

  return (
    <PageContainer maxWidth="sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center">내 프로필</h1>

        <AccountStatus />

        {/* Profile Image Upload */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <ProfileImageUpload
              name={profile.name}
              imageUrl={profileImage}
              onImageChange={setProfileImage}
            />
          </CardContent>
        </Card>

        {/* Trust Score */}
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

        <ProfileCard profile={profile} verification={verification} profileImage={profileImage} />

        <ShareButton profileId={profile.id} />

        <div className="space-y-3">
          <Link href="/profile/verification">
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              인증 관리
              <span className="ml-auto text-sm text-muted-foreground">신뢰점수 높이기</span>
            </Button>
          </Link>
          <Link href="/profile/reference">
            <Button variant="outline" className="w-full justify-start">
              <Users className="h-4 w-4 mr-2" />
              레퍼런스 관리
              <span className="ml-auto text-sm text-muted-foreground">이전 집주인 평가</span>
            </Button>
          </Link>
        </div>

        <div className="pt-4">
          <Link href="/onboarding/basic">
            <Button variant="outline" className="w-full">
              <Edit className="h-4 w-4 mr-2" />
              프로필 수정하기
            </Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
