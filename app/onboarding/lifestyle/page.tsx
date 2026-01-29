'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar } from '@/components/onboarding/progress-bar'
import { LifestyleForm } from '@/components/onboarding/lifestyle-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Profile } from '@/types/database'

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
      <div className="space-y-8 animate-fade-in">
        <ProgressBar currentStep={2} totalSteps={3} />
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
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
