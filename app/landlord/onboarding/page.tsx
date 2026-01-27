'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Home, Loader2, Building, Plus, X } from 'lucide-react'

export default function LandlordOnboardingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    propertyCount: '',
  })
  const [regions, setRegions] = useState<string[]>([])
  const [newRegion, setNewRegion] = useState('')

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
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/landlord/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          propertyCount: formData.propertyCount ? parseInt(formData.propertyCount) : 0,
          propertyRegions: regions,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '프로필 저장에 실패했습니다')
      }

      router.push('/landlord')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">집주인 프로필 설정</CardTitle>
            <CardDescription>
              좋은 세입자를 찾기 위해 정보를 입력해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

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
                    onKeyPress={(e) => {
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
                  <div className="flex flex-wrap gap-2 mt-2">
                    {regions.map((region) => (
                      <span
                        key={region}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {region}
                        <button
                          type="button"
                          onClick={() => handleRemoveRegion(region)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '시작하기'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
