'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressBar } from '@/components/onboarding/progress-bar'
import { BasicForm } from '@/components/onboarding/basic-form'
import { Profile } from '@/types/database'
import { Loader2 } from 'lucide-react'

export default function BasicInfoPage() {
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
      <ProgressBar currentStep={1} totalSteps={3} />
      <BasicForm
        initialData={
          profile
            ? {
                name: profile.name,
                age_range: profile.age_range,
                family_type: profile.family_type,
                pets: profile.pets,
                smoking: profile.smoking,
              }
            : undefined
        }
      />
    </div>
  )
}
