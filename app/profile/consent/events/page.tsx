'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ConsentEvent, ConsentPurpose, ConsentTargetRole } from '@/types/database'

interface ConsentEventApiResponse {
  error?: string
  events: ConsentEvent[]
  pagination: {
    limit: number
    offset: number
    total: number
    hasMore: boolean
  }
  filters: {
    targetRole: string
    targetUserId: string | null
    actorUserId: string | null
    purpose: string | null
    contractId: string | null
    from: string | null
    to: string | null
  }
}

interface ConsentEventFilter {
  targetRole: ConsentTargetRole | 'all'
  purpose: ConsentPurpose | 'all'
  eventType: ConsentEvent['event_type'] | 'all'
  consentId: string
  limit: number
  offset: number
}

const TARGET_ROLE_OPTIONS: Array<{ label: string; value: ConsentTargetRole | 'all' }> = [
  { label: 'all', value: 'all' },
  { label: 'tenant', value: 'tenant' },
  { label: 'landlord', value: 'landlord' },
  { label: 'broker', value: 'broker' },
  { label: 'admin', value: 'admin' },
]

const PURPOSE_OPTIONS: Array<{ label: string; value: ConsentPurpose | 'all' }> = [
  { label: 'all', value: 'all' },
  { label: 'tenant_profile_view', value: 'tenant_profile_view' },
  { label: 'landlord_profile_view', value: 'landlord_profile_view' },
  { label: 'property_view', value: 'property_view' },
]

const EVENT_OPTIONS: Array<{ label: string; value: ConsentEvent['event_type'] | 'all' }> = [
  { label: 'all', value: 'all' },
  { label: 'granted', value: 'granted' },
  { label: 'updated', value: 'updated' },
  { label: 'revoked', value: 'revoked' },
]

function eventTypeClass(type: ConsentEvent['event_type']) {
  if (type === 'granted') return 'bg-green-100 text-green-700'
  if (type === 'updated') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-700'
}

function formatPayload(payload: Record<string, unknown> | null) {
  if (!payload) return '-'
  if (typeof payload !== 'object') return String(payload)
  const keys = Object.entries(payload)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(', ')
  return keys || '-'
}

export default function ConsentEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<ConsentEvent[]>([])
  const [filters, setFilters] = useState<ConsentEventFilter>({
    targetRole: 'all',
    purpose: 'all',
    eventType: 'all',
    consentId: '',
    limit: 30,
    offset: 0,
  })
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(filters.limit))
      params.set('offset', String(filters.offset))
      if (filters.targetRole !== 'all') params.set('targetRole', filters.targetRole)
      if (filters.purpose !== 'all') params.set('purpose', filters.purpose)
      if (filters.eventType !== 'all') params.set('eventType', filters.eventType)
      if (filters.consentId) params.set('consentId', filters.consentId)

      const response = await fetch(`/api/consent/events?${params.toString()}`)
      const data = (await response.json()) as ConsentEventApiResponse

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(data.error || '조회에 실패했습니다.')
      }

      setEvents(data.events)
      setTotal(data.pagination.total)
      setHasMore(data.pagination.hasMore)
    } catch (error) {
      toast.error((error as Error).message)
      setEvents([])
      setTotal(0)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    if (filters.offset !== 0) return
    fetchEvents()
  }, [filters.targetRole, filters.purpose, filters.eventType, filters.consentId, filters.limit])

  const applyFilters = () => {
    setFilters((prev) => ({ ...prev, offset: 0 }))
    fetchEvents()
  }

  const handlePrev = () => {
    if (filters.offset === 0) return
    setFilters((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))
  }

  const handleNext = () => {
    if (!hasMore) return
    setFilters((prev) => ({ ...prev, offset: prev.offset + prev.limit }))
  }

  useEffect(() => {
    fetchEvents()
  }, [filters.offset])

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Consent Event History</h1>
            <p className="text-sm text-muted-foreground">
              모든 동의 이벤트의 이벤트 유형, 대상 역할, 변경 내역을 한곳에서 확인합니다.
            </p>
          </div>
          <Link href="/profile/consent">
            <Button variant="outline">Consent Settings</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Role</label>
              <select
                value={filters.targetRole}
                onChange={(e) => setFilters((prev) => ({ ...prev, targetRole: e.target.value as ConsentTargetRole | 'all' }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {TARGET_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Purpose</label>
              <select
                value={filters.purpose}
                onChange={(e) => setFilters((prev) => ({ ...prev, purpose: e.target.value as ConsentPurpose | 'all' }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PURPOSE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Event</label>
              <select
                value={filters.eventType}
                onChange={(e) => setFilters((prev) => ({ ...prev, eventType: e.target.value as ConsentEvent['event_type'] | 'all' }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Consent ID</label>
              <Input
                value={filters.consentId}
                onChange={(e) => setFilters((prev) => ({ ...prev, consentId: e.target.value }))}
                placeholder="Filter by consent id"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Page size</label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters((prev) => ({ ...prev, limit: Number(e.target.value) }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {[20, 30, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-5">
              <Button onClick={applyFilters}>조회</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Events</span>
              <span className="text-sm text-muted-foreground font-normal">Total: {total}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">조회 중...</p>}

            {!loading && events.length === 0 ? (
              <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Target Role</th>
                      <th className="py-2 pr-4">Purpose</th>
                      <th className="py-2 pr-4">From</th>
                      <th className="py-2 pr-4">To</th>
                      <th className="py-2 pr-4">Consent ID</th>
                      <th className="py-2 pr-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((eventItem) => (
                      <tr key={eventItem.id} className="border-b">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {new Date(eventItem.created_at).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs rounded-full px-2 py-1 ${eventTypeClass(eventItem.event_type)}`}>
                            {eventItem.event_type}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{eventItem.target_role}</td>
                        <td className="py-3 pr-4">{eventItem.purpose}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">{formatPayload(eventItem.from_payload)}</td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">{formatPayload(eventItem.to_payload)}</td>
                        <td className="py-3 pr-4 text-xs">{eventItem.data_consent_id}</td>
                        <td className="py-3 pr-4 text-xs max-w-[220px] break-words">{eventItem.reason ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <p>
                {filters.offset + 1}~{Math.min(filters.offset + events.length, total)} / {total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  disabled={filters.offset === 0 || loading}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNext}
                  disabled={!hasMore || loading}
                >
                  다음
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
