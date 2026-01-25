'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StayTime, Duration, NoiseLevel } from '@/types/database'

const stayTimeOptions: { value: StayTime; label: string }[] = [
  { value: '아침', label: '주로 아침/오전' },
  { value: '저녁', label: '주로 저녁/밤' },
  { value: '주말만', label: '주말에만' },
  { value: '거의없음', label: '거의 없음' },
]

const durationOptions: { value: Duration; label: string }[] = [
  { value: '6개월', label: '6개월 이내' },
  { value: '1년', label: '약 1년' },
  { value: '2년', label: '약 2년' },
  { value: '장기', label: '장기 거주' },
]

const noiseLevelOptions: { value: NoiseLevel; label: string }[] = [
  { value: '조용', label: '조용한 편' },
  { value: '보통', label: '보통' },
  { value: '활발', label: '활발한 편' },
]

interface LifestyleFormProps {
  initialData?: {
    stay_time?: StayTime
    duration?: Duration
    noise_level?: NoiseLevel
    bio?: string
  }
}

export function LifestyleForm({ initialData }: LifestyleFormProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    stay_time: initialData?.stay_time || ('' as StayTime),
    duration: initialData?.duration || ('' as Duration),
    noise_level: initialData?.noise_level || ('' as NoiseLevel),
    bio: initialData?.bio || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stay_time: formData.stay_time,
          duration: formData.duration,
          noise_level: formData.noise_level,
          bio: formData.bio || null,
        }),
      })

      if (!response.ok) {
        throw new Error('저장에 실패했습니다')
      }

      router.push('/onboarding/complete')
    } catch (error) {
      console.error('Error saving lifestyle info:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    formData.stay_time && formData.duration && formData.noise_level

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-center">라이프스타일</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 집에 있는 시간 */}
          <div className="space-y-2">
            <Label>주로 집에 있는 시간</Label>
            <div className="grid grid-cols-2 gap-2">
              {stayTimeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    formData.stay_time === option.value ? 'default' : 'outline'
                  }
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, stay_time: option.value }))
                  }
                  className="w-full text-sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 희망 거주기간 */}
          <div className="space-y-2">
            <Label>희망 거주 기간</Label>
            <div className="grid grid-cols-2 gap-2">
              {durationOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    formData.duration === option.value ? 'default' : 'outline'
                  }
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, duration: option.value }))
                  }
                  className="w-full text-sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 생활 패턴 */}
          <div className="space-y-2">
            <Label>생활 패턴</Label>
            <div className="grid grid-cols-3 gap-2">
              {noiseLevelOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={
                    formData.noise_level === option.value ? 'default' : 'outline'
                  }
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      noise_level: option.value,
                    }))
                  }
                  className="w-full text-sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 자유 한마디 */}
          <div className="space-y-2">
            <Label htmlFor="bio">집주인에게 한마디 (선택)</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, bio: e.target.value }))
              }
              placeholder="집주인에게 전달하고 싶은 메시지를 자유롭게 작성해주세요. (100자 이내)"
              maxLength={100}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.bio.length}/100자
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              이전
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? '저장 중...' : '다음'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
