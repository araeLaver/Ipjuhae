'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantCard {
  profile_id: string
  user_id: string
  name: string
  age_range: string
  family_type: string
  pets: string[]
  smoking: boolean
  stay_time: string | null
  duration: string | null
  noise_level: string | null
  trust_score: number
  bio: string | null
  verified: {
    employment: boolean
    income: boolean
    credit: boolean
  }
  reference_count: number
  profile_image_url: string | null
  created_at: string
}

export interface TenantFilters {
  region: string[]
  family_type: string[]
  pets: string[]
  noise_level: string[]
  duration: string[]
  verified: string[]
  smoking: '' | 'true' | 'false'
  has_reference: '' | 'true'
  trust_min: number
  trust_max: number
  sort: 'trust_desc' | 'created_desc' | 'reference_desc' | 'verified_desc'
}

export const DEFAULT_FILTERS: TenantFilters = {
  region: [],
  family_type: [],
  pets: [],
  noise_level: [],
  duration: [],
  verified: [],
  smoking: '',
  has_reference: '',
  trust_min: 0,
  trust_max: 120,
  sort: 'trust_desc',
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTenantSearch(limit = 12) {
  const [tenants, setTenants] = useState<TenantCard[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<TenantFilters>(DEFAULT_FILTERS)
  const [error, setError] = useState<string | null>(null)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Build URLSearchParams from filters
  const buildParams = useCallback(
    (f: TenantFilters, cursor?: string | null): URLSearchParams => {
      const p = new URLSearchParams()
      p.set('limit', String(limit))

      if (cursor) p.set('cursor', cursor)
      if (f.sort) p.set('sort', f.sort)

      f.region.forEach((v) => p.append('region', v))
      f.family_type.forEach((v) => p.append('family_type', v))
      f.pets.forEach((v) => p.append('pets', v))
      f.noise_level.forEach((v) => p.append('noise_level', v))
      f.duration.forEach((v) => p.append('duration', v))
      f.verified.forEach((v) => p.append('verified', v))

      if (f.smoking) p.set('smoking', f.smoking)
      if (f.has_reference) p.set('has_reference', f.has_reference)
      if (f.trust_min > 0) p.set('trust_min', String(f.trust_min))
      if (f.trust_max < 120) p.set('trust_max', String(f.trust_max))

      return p
    },
    [limit]
  )

  // Fetch first page (replace results)
  const fetchFirst = useCallback(
    async (f: TenantFilters) => {
      // Cancel previous request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsLoading(true)
      setError(null)

      try {
        const params = buildParams(f)
        const res = await fetch(`/api/landlord/tenants?${params}`, {
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '목록 조회 실패')
        }

        const data = await res.json()
        setTenants(data.tenants ?? [])
        setTotalCount(data.total_count ?? 0)
        setNextCursor(data.next_cursor ?? null)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
    },
    [buildParams]
  )

  // Fetch next page (append results)
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    setError(null)

    try {
      const params = buildParams(filters, nextCursor)
      const res = await fetch(`/api/landlord/tenants?${params}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '목록 조회 실패')
      }

      const data = await res.json()
      setTenants((prev) => [...prev, ...(data.tenants ?? [])])
      setNextCursor(data.next_cursor ?? null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoadingMore(false)
    }
  }, [nextCursor, isLoadingMore, filters, buildParams])

  // Debounced filter update
  const setFilters = useCallback(
    (updater: TenantFilters | ((prev: TenantFilters) => TenantFilters)) => {
      setFiltersState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater

        if (debounceTimer.current) clearTimeout(debounceTimer.current)
        debounceTimer.current = setTimeout(() => {
          fetchFirst(next)
        }, 300)

        return next
      })
    },
    [fetchFirst]
  )

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    fetchFirst(DEFAULT_FILTERS)
  }, [fetchFirst])

  // Initial load
  useEffect(() => {
    fetchFirst(DEFAULT_FILTERS)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (abortRef.current) abortRef.current.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    tenants,
    isLoading,
    isLoadingMore,
    hasMore: nextCursor !== null,
    totalCount,
    error,
    filters,
    setFilters,
    resetFilters,
    loadMore,
    refresh: () => fetchFirst(filters),
  }
}
