'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar } from '@/components/onboarding/progress-bar'
import { LifestyleForm } from '@/components/onboarding/lifestyle-form'
import { Profile } from '@/types/database'
import { Loader2 } from 'lucide-react'

export default function LifestylePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
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

        // 기본 정보가 없으면 첫 단계로
        if (!data.profile?.name) {
          router.push('/onboarding/basic')
          return
        }

        setProfile(data.profile)
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
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ProgressBar currentStep={2} totalSteps={3} />
      <LifestyleForm
        initialData={
          profile
            ? {
                stay_time: profile.stay_time ?? undefined,
                duration: profile.duration ?? undefined,
                noise_level: profile.noise_level ?? undefined,
                bio: profile.bio ?? undefined,
              }
            : undefined
        }
      />
    </div>
  )
}
