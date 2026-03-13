'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TenantProfileForm } from '@/components/profile/tenant-profile-form'
import { PageContainer } from '@/components/layout/page-container'
import { Skeleton } from '@/components/ui/skeleton'
import { TenantProfile } from '@/types/database'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function TenantProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/tenant/profile')
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile ?? null)
        }
      } catch (error) {
        console.error('Failed to load tenant profile:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="프로필로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">임차인 프로필</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <TenantProfileForm
            initialData={profile}
            onSaved={(updated) => setProfile(updated)}
          />
        )}
      </div>
    </PageContainer>
  )
}
