'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TenantListItem } from '@/components/landlord/tenant-list-item'
import { TenantFilter, FilterState } from '@/components/landlord/tenant-filter'
import { Home, ArrowLeft, Loader2, Users } from 'lucide-react'
import { Profile, Verification } from '@/types/database'

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

const initialFilters: FilterState = {
  ageRange: '',
  familyType: '',
  minScore: '',
  smoking: '',
}

export default function TenantsPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<(Profile & { verification?: Verification })[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchTenants = useCallback(async (page = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())

      // 필터 적용 ('all' 값은 빈 문자열로 처리)
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          params.set(key, value)
        }
      })

      const response = await fetch(`/api/landlord/tenants?${params}`)
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

      setProfiles(data.profiles)
      setPagination(data.pagination)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [filters, router])

  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  const handleFilterReset = () => {
    setFilters(initialFilters)
  }

  const handlePageChange = (page: number) => {
    fetchTenants(page)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/landlord')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">세입자 찾기</h1>
            <p className="text-muted-foreground">인증된 세입자들의 프로필을 확인하세요</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* Filter */}
          <TenantFilter
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />

          {/* Results Count */}
          {pagination && (
            <p className="text-sm text-muted-foreground">
              총 {pagination.totalCount}명의 세입자
            </p>
          )}

          {/* Tenant List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : profiles.length > 0 ? (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <TenantListItem key={profile.id} profile={profile} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">조건에 맞는 세입자가 없습니다</p>
              <p className="text-sm text-muted-foreground">필터를 조정해보세요</p>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                이전
              </Button>
              <span className="flex items-center px-4">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
