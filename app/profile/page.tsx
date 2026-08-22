'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Edit, FileText, Eye, Shield, Users } from 'lucide-react'
import { calculateTrustScore } from '@/lib/trust-score'
import { Profile, Verification } from '@/types/database'
import { PageContainer } from '@/components/layout/page-container'
import { ProfileCard } from '@/components/profile/profile-card'
import { ShareButton } from '@/components/profile/share-button'
import { TrustScoreChart } from '@/components/profile/trust-score-chart'
import { ProfileImageUpload } from '@/components/profile/profile-image-upload'
import { AccountStatus } from '@/components/profile/account-status'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

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
        <h1 className="text-2xl font-bold text-center">프로필</h1>
        <AccountStatus />

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <ProfileImageUpload name={profile.name} imageUrl={profileImage} onImageChange={setProfileImage} />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">신뢰 점수</CardTitle>
          </CardHeader>
          <CardContent>
            <TrustScoreChart total={scoreBreakdown.total} breakdown={scoreBreakdown} />
          </CardContent>
        </Card>

        <ProfileCard profile={profile} verification={verification} profileImage={profileImage} />
        <ShareButton profileId={profile.id} />

        <div className="space-y-3">
          <Link href="/profile/verification">
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              인증 설정
              <span className="ml-auto text-sm text-muted-foreground">상태 및 서류</span>
            </Button>
          </Link>

          <Link href="/profile/reference">
            <Button variant="outline" className="w-full justify-start">
              <Users className="h-4 w-4 mr-2" />
              추천서 요청
              <span className="ml-auto text-sm text-muted-foreground">세입자 추천서 절차 관리</span>
            </Button>
          </Link>

          <Link href="/profile/consent">
            <Button variant="outline" className="w-full justify-start">
              <Eye className="h-4 w-4 mr-2" />
              동의 설정
              <span className="ml-auto text-sm text-muted-foreground">활성 동의 항목 관리</span>
            </Button>
          </Link>

          <Link href="/profile/consent/events">
            <Button variant="outline" className="w-full justify-start">
              <Eye className="h-4 w-4 mr-2" />
              동의 이벤트 내역
              <span className="ml-auto text-sm text-muted-foreground">동의 및 폐기 기록</span>
            </Button>
          </Link>

          <Link href="/profile/access-logs">
            <Button variant="outline" className="w-full justify-start">
              <FileText className="h-4 w-4 mr-2" />
              접근 로그
              <span className="ml-auto text-sm text-muted-foreground">누가 어떤 데이터를 열람했는지</span>
            </Button>
          </Link>
        </div>

        <div className="pt-4">
          <Link href="/profile/edit">
            <Button variant="outline" className="w-full">
              <Edit className="h-4 w-4 mr-2" />
              기본 프로필 수정
            </Button>
          </Link>
        </div>

        <AccountDeleteSection />
      </div>
    </PageContainer>
  )
}

function AccountDeleteSection() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || '계정 삭제에 실패했습니다.')
        return
      }
      router.push('/login?deleted=1')
    } catch {
      setError('계정 삭제를 처리하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10">
          계정 삭제
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>계정을 삭제하시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription>
            계정을 삭제하면 프로필 정보, 대화 내역, 관련 자료가 모두 삭제됩니다. 삭제 후에는 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? '삭제 중...' : '삭제'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
