'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageContainer } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { track } from '@/lib/analytics-client'

interface TenantProfile {
  id: number
  user_id: number
  budget_min: number
  budget_max: number
  preferred_region: string
  move_in_date: string | null
  has_pets: boolean
  job_title: string | null
  company_name: string | null
}

interface FormState {
  budget_min: string
  budget_max: string
  preferred_region: string
  move_in_date: string
  has_pets: boolean
  job_title: string
  company_name: string
}

const defaultForm: FormState = {
  budget_min: '',
  budget_max: '',
  preferred_region: '',
  move_in_date: '',
  has_pets: false,
  job_title: '',
  company_name: '',
}

function profileToForm(profile: TenantProfile): FormState {
  return {
    budget_min: profile.budget_min > 0 ? String(profile.budget_min) : '',
    budget_max: profile.budget_max > 0 ? String(profile.budget_max) : '',
    preferred_region: profile.preferred_region ?? '',
    move_in_date: profile.move_in_date
      ? profile.move_in_date.slice(0, 10)
      : '',
    has_pets: profile.has_pets ?? false,
    job_title: profile.job_title ?? '',
    company_name: profile.company_name ?? '',
  }
}

export default function TenantProfilePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/tenant/profile')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        if (data.profile) {
          setForm(profileToForm(data.profile))
        }
      } catch (error) {
        console.error('Failed to load tenant profile:', error)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [router])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? e.target.checked : value,
    }))
  }

  function validate(): string | null {
    const min = Number(form.budget_min)
    const max = Number(form.budget_max)
    if (!form.budget_min || isNaN(min) || min < 0)
      return '예산 최솟값을 올바르게 입력해주세요'
    if (!form.budget_max || isNaN(max) || max < 0)
      return '예산 최댓값을 올바르게 입력해주세요'
    if (min > max)
      return '예산 최솟값이 최댓값보다 클 수 없습니다'
    if (!form.preferred_region.trim())
      return '희망 지역을 입력해주세요'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const errorMsg = validate()
    if (errorMsg) {
      toast.error(errorMsg)
      return
    }

    setSaving(true)
    try {
      const payload = {
        budget_min: Number(form.budget_min),
        budget_max: Number(form.budget_max),
        preferred_region: form.preferred_region.trim(),
        move_in_date: form.move_in_date || undefined,
        has_pets: form.has_pets,
        job_title: form.job_title.trim() || undefined,
        company_name: form.company_name.trim() || undefined,
      }

      const res = await fetch('/api/tenant/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '저장에 실패했습니다')
      }

      track('profile_complete', { section: 'tenant_profile' })
      track('profile_submitted', {
        timestamp: new Date().toISOString(),
        has_pets: form.has_pets,
        has_move_in_date: !!form.move_in_date,
      })
      toast.success('프로필이 저장되었습니다')
    } catch (error) {
      const message = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PageContainer maxWidth="sm">
        <div className="space-y-6">
          <Skeleton className="h-8 w-40 mx-auto" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="sm">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center">세입자 프로필</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 예산 범위 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">예산 범위 (만원)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget_min">최솟값 (만원)</Label>
                  <Input
                    id="budget_min"
                    name="budget_min"
                    type="number"
                    min={0}
                    placeholder="예: 30"
                    value={form.budget_min}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_max">최댓값 (만원)</Label>
                  <Input
                    id="budget_max"
                    name="budget_max"
                    type="number"
                    min={0}
                    placeholder="예: 60"
                    value={form.budget_max}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 희망 지역 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">희망 지역</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="preferred_region">희망 지역</Label>
              <Input
                id="preferred_region"
                name="preferred_region"
                type="text"
                placeholder="예: 서울 마포구, 강남구"
                value={form.preferred_region}
                onChange={handleChange}
                required
              />
            </CardContent>
          </Card>

          {/* 입주 희망일 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">입주 희망일</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="move_in_date">입주 희망일 (선택)</Label>
              <Input
                id="move_in_date"
                name="move_in_date"
                type="date"
                value={form.move_in_date}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          {/* 반려동물 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">반려동물</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  id="has_pets"
                  name="has_pets"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={form.has_pets}
                  onChange={handleChange}
                />
                <span className="text-sm font-medium leading-none">
                  반려동물을 키우고 있어요
                </span>
              </label>
            </CardContent>
          </Card>

          {/* 직장 정보 */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">직장 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job_title">직책 (선택)</Label>
                <Input
                  id="job_title"
                  name="job_title"
                  type="text"
                  placeholder="예: 개발자, 디자이너"
                  value={form.job_title}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">회사명 (선택)</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  type="text"
                  placeholder="예: (주)렌트미"
                  value={form.company_name}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={saving}
          >
            {saving ? '저장 중...' : '프로필 저장하기'}
          </Button>
        </form>
      </div>
    </PageContainer>
  )
}
