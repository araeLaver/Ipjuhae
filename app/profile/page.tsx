'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileCard } from '@/components/profile/profile-card'
import { ShareButton } from '@/components/profile/share-button'
import { Button } from '@/components/ui/button'
import { Home, LogOut, Edit, Loader2, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import { Profile, Verification } from '@/types/database'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [verification, setVerification] = useState<Verification | null>(null)
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
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">입주해</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-center">내 프로필</h1>

          <ProfileCard profile={profile} verification={verification} />

          <ShareButton profileId={profile.id} />

          {/* 인증 및 레퍼런스 관리 */}
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
      </main>
    </div>
  )
}
