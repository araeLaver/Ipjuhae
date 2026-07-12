'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AccessAuditLog, AccessTargetType } from '@/types/database'

type TargetFilter = 'all' | AccessTargetType

interface ApiResponse {
  error?: string
  logs: AccessAuditLog[]
  pagination: {
    limit: number
    offset: number
    total: number
    hasMore: boolean
  }
  filters: {
    targetType: string
    targetUserId: string | null
    actorUserId: string | null
    purpose: string | null
    contractId: string | null
    from: string | null
    to: string | null
  }
}

const TARGET_OPTIONS: { value: TargetFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'tenant_profile', label: '임차인 프로필' },
  { value: 'landlord_profile', label: '임대인 프로필' },
  { value: 'property', label: '매물' },
]

export default function AccessLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<AccessAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(30)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [targetType, setTargetType] = useState<TargetFilter>('all')
  const [actorUserId, setActorUserId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [contractId, setContractId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [me, setMe] = useState<{ userType: string } | null>(null)

  const isAdmin = me?.userType === 'admin'

  const fetchMe = async () => {
    const userRes = await fetch('/api/auth/me')
    if (!userRes.ok) {
      return
    }
    const payload = (await userRes.json()) as { user?: { userType?: string } | null }
    setMe(payload.user ? { userType: payload.user.userType || '' } : null)
  }

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      if (targetType !== 'all') params.set('targetType', targetType)
      if (actorUserId) params.set('actorUserId', actorUserId)
      if (targetUserId) params.set('targetUserId', targetUserId)
      if (purpose) params.set('purpose', purpose)
      if (contractId) params.set('contractId', contractId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const response = await fetch(`/api/access-logs?${params.toString()}`)
      const data = (await response.json()) as ApiResponse

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(data.error || '열람 로그 조회 실패')
      }

      setLogs(data.logs)
      setHasMore(data.pagination.hasMore)
      setTotal(data.pagination.total)
    } catch (e) {
      setError((e as Error).message)
      setLogs([])
      setHasMore(false)
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMe().then(fetchLogs)
  }, [router])

  const handleApply = () => {
    setOffset(0)
    fetchLogs()
  }

  const handlePrev = () => {
    const nextOffset = Math.max(0, offset - limit)
    setOffset(nextOffset)
  }

  const handleNext = () => {
    const nextOffset = offset + limit
    setOffset(nextOffset)
  }

  useEffect(() => {
    if (offset >= 0 && total >= 0) {
      fetchLogs()
    }
  }, [offset])

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">접근 로그</h1>
          <p className="text-muted-foreground">
            내 정보/매물 데이터가 언제 어떤 계정에서 조회되었는지 확인합니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>조회 필터</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>대상 타입</Label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as TargetFilter)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {TARGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label>요청자 사용자 ID</Label>
                  <Input value={actorUserId} onChange={(e) => setActorUserId(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label>목표 사용자 ID</Label>
                <Input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>목적</Label>
                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>계약 ID</Label>
                <Input value={contractId} onChange={(e) => setContractId(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>시작일시</Label>
                <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>종료일시</Label>
                <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApply}>조회</Button>
              <Button variant="outline" onClick={() => setOffset(0)}>
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>로그 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">기록이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4">시간</th>
                      <th className="py-2 pr-4">대상 타입</th>
                      <th className="py-2 pr-4">목표 사용자</th>
                      <th className="py-2 pr-4">목적</th>
                      <th className="py-2 pr-4">필드</th>
                      {isAdmin && <th className="py-2 pr-4">요청자</th>}
                      <th className="py-2 pr-4">대상 ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b">
                        <td className="py-3 pr-4">
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 pr-4">{log.target_type}</td>
                        <td className="py-3 pr-4 break-all max-w-[120px]">{log.target_user_id ?? '-'}</td>
                        <td className="py-3 pr-4">{log.purpose}</td>
                        <td className="py-3 pr-4">
                          {log.fields_viewed?.length ? log.fields_viewed.join(', ') : '-'}
                        </td>
                        {isAdmin && <td className="py-3 pr-4 break-all max-w-[120px]">{log.actor_user_id ?? '-'}</td>}
                        <td className="py-3 pr-4 break-all">{log.target_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <p>전체 {total}건</p>
              <p>
                {offset + 1}~{Math.min(offset + logs.length, total)} / {total}
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={handlePrev} disabled={offset === 0 || loading}>
                이전
              </Button>
              <Button variant="outline" onClick={handleNext} disabled={!hasMore || loading}>
                다음
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
