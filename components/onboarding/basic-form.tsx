'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AgeRange, FamilyType, Pet } from '@/types/database'

const ageRangeOptions: AgeRange[] = ['20대초반', '20대후반', '30대', '40대이상']
const familyTypeOptions: FamilyType[] = ['1인', '커플', '가족']
const petOptions: Pet[] = ['없음', '강아지', '고양이', '기타']

interface BasicFormProps {
  initialData?: {
    name?: string
    age_range?: AgeRange
    family_type?: FamilyType
    pets?: Pet[]
    smoking?: boolean
  }
}

export function BasicForm({ initialData }: BasicFormProps) {
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    age_range: initialData?.age_range || ('' as AgeRange),
    family_type: initialData?.family_type || ('' as FamilyType),
    pets: initialData?.pets || ([] as Pet[]),
    smoking: initialData?.smoking || false,
  })

  const handlePetToggle = (pet: Pet) => {
    setFormData((prev) => {
      if (pet === '없음') {
        return { ...prev, pets: prev.pets.includes('없음') ? [] : ['없음'] }
      }

      let newPets = prev.pets.filter((p) => p !== '없음')
      if (newPets.includes(pet)) {
        newPets = newPets.filter((p) => p !== pet)
      } else {
        newPets.push(pet)
      }
      return { ...prev, pets: newPets }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          age_range: formData.age_range,
          family_type: formData.family_type,
          pets: formData.pets.length > 0 ? formData.pets : ['없음'],
          smoking: formData.smoking,
        }),
      })

      if (!response.ok) {
        throw new Error('저장에 실패했습니다')
      }

      router.push('/onboarding/lifestyle')
    } catch (error) {
      console.error('Error saving basic info:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid =
    formData.name && formData.age_range && formData.family_type

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-center">기본 정보 입력</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name">이름 (닉네임)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="집주인에게 보여질 이름"
              required
            />
          </div>

          {/* 나이대 */}
          <div className="space-y-2">
            <Label>나이대</Label>
            <div className="grid grid-cols-2 gap-2">
              {ageRangeOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={formData.age_range === option ? 'default' : 'outline'}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, age_range: option }))
                  }
                  className="w-full"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* 가구 형태 */}
          <div className="space-y-2">
            <Label>가구 형태</Label>
            <div className="grid grid-cols-3 gap-2">
              {familyTypeOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={
                    formData.family_type === option ? 'default' : 'outline'
                  }
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, family_type: option }))
                  }
                  className="w-full"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* 반려동물 */}
          <div className="space-y-2">
            <Label>반려동물 (복수 선택 가능)</Label>
            <div className="grid grid-cols-2 gap-2">
              {petOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={formData.pets.includes(option) ? 'default' : 'outline'}
                  onClick={() => handlePetToggle(option)}
                  className="w-full"
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          {/* 흡연 여부 */}
          <div className="space-y-2">
            <Label>흡연 여부</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!formData.smoking ? 'default' : 'outline'}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, smoking: false }))
                }
                className="w-full"
              >
                비흡연
              </Button>
              <Button
                type="button"
                variant={formData.smoking ? 'default' : 'outline'}
                onClick={() =>
                  setFormData((prev) => ({ ...prev, smoking: true }))
                }
                className="w-full"
              >
                흡연
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? '저장 중...' : '다음'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
