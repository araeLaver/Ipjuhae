'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ProgressBar } from '@/components/onboarding/progress-bar'
import { Loader2, Check } from 'lucide-react'
import { Profile } from '@/types/database'

export default function CompletePage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [intro, setIntro] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch('/api/profile')
        if (response.status === 401) {
          router.push('/login')
          return
        }
        const data = await response.json()

        if (!data.profile?.stay_time) {
          router.push('/onboarding/lifestyle')
          return
        }

        setProfile(data.profile)
        setIntro(data.profile.intro || '')
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  const handleComplete = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intro: intro || null,
          is_complete: true,
        }),
      })

      if (!response.ok) {
        throw new Error('저장에 실패했습니다')
      }

      router.push('/profile')
    } catch (error) {
      console.error('Error completing profile:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ProgressBar currentStep={3} totalSteps={3} />

      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="text-center">자기소개서 작성</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="intro">집주인에게 보낼 자기소개서 (선택)</Label>
            <Textarea
              id="intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="안녕하세요. 저는 조용하고 깔끔한 생활을 선호하는 직장인입니다. 장기 거주를 희망하며, 집 관리에 항상 신경 쓰겠습니다..."
              rows={6}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground text-right">
              {intro.length}/300자
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              자기소개서는 나중에 프로필에서 수정할 수 있습니다.
              <br />
              지금 작성하지 않아도 프로필을 완성할 수 있어요.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/onboarding/lifestyle')}
              className="flex-1"
            >
              이전
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  프로필 완성
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
