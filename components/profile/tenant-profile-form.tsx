'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TenantProfile } from '@/types/database'
import { SEOUL_DISTRICTS, TenantProfileInput } from '@/lib/validations'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

interface TenantProfileFormProps {
  initialData?: TenantProfile | null
  onSaved?: (profile: TenantProfile) => void
}

function ToggleButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm border transition-colors',
        selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:border-primary'
      )}
    >
      {children}
    </button>
  )
}

type FormErrors = Partial<Record<keyof TenantProfileInput | 'general', string>>

export function TenantProfileForm({ initialData, onSaved }: TenantProfileFormProps) {
  const today = new Date().toISOString().split('T')[0]

  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const [budgetMin, setBudgetMin] = useState<string>(
    initialData ? String(initialData.budget_min) : ''
  )
  const [budgetMax, setBudgetMax] = useState<string>(
    initialData ? String(initialData.budget_max) : ''
  )
  const [preferredDistricts, setPreferredDistricts] = useState<string[]>(
    initialData?.preferred_districts ?? []
  )
  const [moveInDate, setMoveInDate] = useState<string>(
    initialData?.move_in_date
      ? String(initialData.move_in_date).slice(0, 10)
      : ''
  )
  const [hasPets, setHasPets] = useState<boolean>(initialData?.has_pets ?? false)
  const [workplace, setWorkplace] = useState<string>(initialData?.workplace ?? '')

  function toggleDistrict(district: string) {
    setPreferredDistricts((prev) => {
      if (prev.includes(district)) {
        return prev.filter((d) => d !== district)
      }
      if (prev.length >= 5) {
        toast.error('선호 지역은 최대 5개까지 선택 가능합니다')
        return prev
      }
      return [...prev, district]
    })
  }

  function validate(): TenantProfileInput | null {
    const newErrors: FormErrors = {}

    const minVal = parseInt(budgetMin, 10)
    const maxVal = parseInt(budgetMax, 10)

    if (budgetMin === '' || isNaN(minVal) || minVal < 0) {
      newErrors.budget_min = '최소 예산을 올바르게 입력해주세요 (만원 단위)'
    }
    if (budgetMax === '' || isNaN(maxVal) || maxVal < 0) {
      newErrors.budget_max = '최대 예산을 올바르게 입력해주세요 (만원 단위)'
    }
    if (!newErrors.budget_min && !newErrors.budget_max && maxVal < minVal) {
      newErrors.budget_max = '최대 예산은 최소 예산 이상이어야 합니다'
    }
    if (preferredDistricts.length === 0) {
      newErrors.preferred_districts = '선호 지역을 최소 1개 선택해주세요'
    }
    if (!moveInDate) {
      newErrors.move_in_date = '입주 희망일을 선택해주세요'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return null
    }

    setErrors({})
    return {
      budget_min: minVal,
      budget_max: maxVal,
      preferred_districts: preferredDistricts,
      move_in_date: moveInDate,
      has_pets: hasPets,
      workplace: workplace.trim() || null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const data = validate()
    if (!data) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/tenant/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error || '저장에 실패했습니다')
      }

      const json = await response.json()
      trackEvent('profile_complete', {
        budget_min: data.budget_min,
        budget_max: data.budget_max,
        region_count: data.preferred_districts.length,
        has_pets: data.has_pets,
      })
      toast.success('임차인 프로필이 저장되었습니다')
      onSaved?.(json.profile)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '프로필 저장 중 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">임차인 프로필 입력</CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          원하는 조건을 입력하면 집주인이 먼저 연락할 수 있어요
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>

          {/* 예산 */}
          <div className="space-y-2">
            <Label>예산 (만원 단위)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <Input
                  type="number"
                  id="budget_min"
                  placeholder="최소 (예: 30)"
                  min={0}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  aria-invalid={!!errors.budget_min}
                />
                {errors.budget_min && (
                  <p className="text-xs text-destructive">{errors.budget_min}</p>
                )}
              </div>
              <span className="text-muted-foreground text-sm shrink-0">~</span>
              <div className="flex-1 space-y-1">
                <Input
                  type="number"
                  id="budget_max"
                  placeholder="최대 (예: 60)"
                  min={0}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  aria-invalid={!!errors.budget_max}
                />
                {errors.budget_max && (
                  <p className="text-xs text-destructive">{errors.budget_max}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">월세 기준 만원 단위로 입력해주세요</p>
          </div>

          {/* 선호 지역 */}
          <div className="space-y-2">
            <Label>
              선호 지역{' '}
              <span className="text-muted-foreground text-xs font-normal">
                (최대 5개, 현재 {preferredDistricts.length}개 선택)
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {SEOUL_DISTRICTS.map((district) => (
                <ToggleButton
                  key={district}
                  selected={preferredDistricts.includes(district)}
                  onClick={() => toggleDistrict(district)}
                >
                  {district}
                </ToggleButton>
              ))}
            </div>
            {errors.preferred_districts && (
              <p className="text-xs text-destructive">{errors.preferred_districts}</p>
            )}
          </div>

          {/* 입주 희망일 */}
          <div className="space-y-2">
            <Label htmlFor="move_in_date">입주 희망일</Label>
            <Input
              type="date"
              id="move_in_date"
              min={today}
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              aria-invalid={!!errors.move_in_date}
            />
            {errors.move_in_date && (
              <p className="text-xs text-destructive">{errors.move_in_date}</p>
            )}
          </div>

          {/* 반려동물 여부 */}
          <div className="space-y-2">
            <Label>반려동물 여부</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!hasPets ? 'default' : 'outline'}
                onClick={() => setHasPets(false)}
                className="w-full"
              >
                없음
              </Button>
              <Button
                type="button"
                variant={hasPets ? 'default' : 'outline'}
                onClick={() => setHasPets(true)}
                className="w-full"
              >
                있음
              </Button>
            </div>
          </div>

          {/* 직장 */}
          <div className="space-y-2">
            <Label htmlFor="workplace">
              직장{' '}
              <span className="text-muted-foreground text-xs font-normal">(선택)</span>
            </Label>
            <Input
              type="text"
              id="workplace"
              placeholder="예: 강남구 IT회사, 종로구 공무원"
              maxLength={100}
              value={workplace}
              onChange={(e) => setWorkplace(e.target.value)}
              aria-invalid={!!errors.workplace}
            />
            {errors.workplace && (
              <p className="text-xs text-destructive">{errors.workplace}</p>
            )}
            <p className="text-xs text-muted-foreground">
              회사명 또는 직장 위치를 자유롭게 입력해주세요
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSaving}
          >
            {isSaving ? '저장 중...' : '프로필 저장'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
