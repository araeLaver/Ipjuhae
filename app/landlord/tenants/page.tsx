'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { TenantListItem } from '@/components/landlord/tenant-list-item'
import { TenantFilter, FilterState } from '@/components/landlord/tenant-filter'
import { PageContainer } from '@/components/layout/page-container'
import { Users } from 'lucide-react'
import { Profile, Verification } from '@/types/database'
import { toast } from 'sonner'

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

  const fetchTenants = useCallback(async (page = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page.toString())

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
      toast.error((err as Error).message)
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
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">세입자 찾기</h1>
          <p className="text-muted-foreground">인증된 세입자들의 프로필을 확인하세요</p>
        </div>

        <TenantFilter
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
        />

        {pagination && (
          <p className="text-sm text-muted-foreground">
            총 {pagination.totalCount}명의 세입자
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : profiles.length > 0 ? (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <TenantListItem key={profile.id} profile={profile} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="조건에 맞는 세입자가 없습니다"
            description="필터를 조정해보세요"
          />
        )}

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
    </PageContainer>
  )
}
