'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Home, Users, Building, Settings, Loader2, ArrowRight } from 'lucide-react'
import { LandlordProfile } from '@/types/database'

export default function LandlordDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<LandlordProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

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

      setProfile(data.profile)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
            <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">집주인</span>
          </Link>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* Welcome Section */}
          <div>
            <h1 className="text-2xl font-bold">안녕하세요, {profile?.name}님!</h1>
            <p className="text-muted-foreground">입주해에서 좋은 세입자를 찾아보세요</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Building className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{profile?.property_count || 0}</p>
                  <p className="text-sm text-muted-foreground">보유 매물</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">-</p>
                  <p className="text-sm text-muted-foreground">열람한 프로필</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Actions */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">바로가기</h2>

            <Link href="/landlord/tenants">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">세입자 찾기</h3>
                        <p className="text-sm text-muted-foreground">
                          인증된 세입자 프로필을 검색하세요
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Property Regions */}
          {profile?.property_regions && profile.property_regions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">내 매물 지역</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.property_regions.map((region, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      {region}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
