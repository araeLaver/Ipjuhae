'use client'

import { useEffect, useState } from 'react'
import { useParams, notFound } from 'next/navigation'
import { ProfileCard } from '@/components/profile/profile-card'
import { Button } from '@/components/ui/button'
import { Home, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Profile, Verification } from '@/types/database'

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
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">프로필을 찾을 수 없습니다</h1>
          <p className="text-muted-foreground mb-4">존재하지 않거나 공개되지 않은 프로필입니다.</p>
          <Link href="/">
            <Button>홈으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    )
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
            <Link href="/">
              <Button variant="outline" size="sm">
                나도 프로필 만들기
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">세입자 프로필</p>
            <h1 className="text-2xl font-bold">{profile.name}님의 프로필</h1>
          </div>

          <ProfileCard profile={profile} verification={verification} />

          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-sm text-blue-800">
              이 프로필은{' '}
              <Link href="/" className="font-semibold underline">
                입주해
              </Link>
              에서 생성되었습니다.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              신뢰할 수 있는 세입자 프로필을 만들어보세요.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
