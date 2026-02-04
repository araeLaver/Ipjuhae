'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageContainer } from '@/components/layout/page-container'
import { Building, Loader2, Plus, X, Save, ArrowLeft } from 'lucide-react'
import { LandlordProfile } from '@/types/database'
import { toast } from 'sonner'
import Link from 'next/link'

export default function LandlordProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    propertyCount: '',
  })
  const [regions, setRegions] = useState<string[]>([])
  const [newRegion, setNewRegion] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/landlord/profile')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        if (response.status === 403) {
          router.push('/landlord/onboarding')
          return
        }
        throw new Error(data.error)
      }

      if (!data.profile) {
        router.push('/landlord/onboarding')
        return
      }

      const p = data.profile as LandlordProfile
      setProfile(p)
      setFormData({
        name: p.name || '',
        phone: p.phone || '',
        propertyCount: p.property_count?.toString() || '0',
      })
      setRegions(p.property_regions || [])
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddRegion = () => {
    if (newRegion.trim() && !regions.includes(newRegion.trim())) {
      setRegions([...regions, newRegion.trim()])
      setNewRegion('')
    }
  }

  const handleRemoveRegion = (region: string) => {
    setRegions(regions.filter((r) => r !== region))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch('/api/landlord/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
          propertyCount: formData.propertyCount ? parseInt(formData.propertyCount) : 0,
          propertyRegions: regions,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '프로필 저장에 실패했습니다')
      }

      toast.success('프로필이 저장되었습니다')
      setProfile(data.profile)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/landlord">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              대시보드
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>프로필 수정</CardTitle>
                <CardDescription>집주인 정보를 수정합니다</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="홍길동"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">연락처</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="010-1234-5678"
                />
                <p className="text-xs text-muted-foreground">
                  세입자에게 공개되지 않습니다
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyCount">보유 매물 수</Label>
                <Input
                  id="propertyCount"
                  type="number"
                  min="0"
                  value={formData.propertyCount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, propertyCount: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>매물 지역</Label>
                <div className="flex gap-2">
                  <Input
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    placeholder="서울시 강남구"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddRegion()
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddRegion}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {regions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {regions.map((region) => (
                      <span
                        key={region}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary/5 text-primary rounded-full text-sm border border-primary/10"
                      >
                        {region}
                        <button
                          type="button"
                          onClick={() => handleRemoveRegion(region)}
                          className="text-primary/60 hover:text-primary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  보유하신 매물의 지역을 추가해주세요
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      저장하기
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">계정 정보</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>가입일: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ko-KR') : '-'}</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
