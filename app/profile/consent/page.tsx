'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ConsentPurpose, ConsentTargetRole, DataConsent } from '@/types/database'

type ConsentField = 'basic_profile' | 'verification' | 'bio' | 'references' | 'trust_score' | 'contact'

const FIELD_OPTIONS: Array<{ key: ConsentField; label: string }> = [
  { key: 'basic_profile', label: '기본 프로필' },
  { key: 'verification', label: '검증 상태' },
  { key: 'bio', label: '자기소개' },
  { key: 'references', label: '레퍼런스' },
  { key: 'trust_score', label: '신뢰 점수' },
  { key: 'contact', label: '연락처' },
]

const DEFAULT_ALLOWED_FIELDS: Record<ConsentField, boolean> = {
  basic_profile: true,
  verification: true,
  bio: false,
  references: false,
  trust_score: true,
  contact: false,
}

const TARGET_ROLE_OPTIONS: Array<{ value: ConsentTargetRole; label: string }> = [
  { value: 'tenant', label: '임차인 조회자' },
  { value: 'landlord', label: '임대인 조회자' },
  { value: 'broker', label: '중개사 조회자' },
  { value: 'admin', label: '관리자 조회자' },
]

const PURPOSE_OPTIONS: Array<{ value: ConsentPurpose; label: string }> = [
  { value: 'tenant_profile_view', label: '임차인 프로필 조회' },
  { value: 'landlord_profile_view', label: '임대인 프로필 조회' },
  { value: 'property_view', label: '매물 조회' },
]

interface ConsentResponse {
  consents: DataConsent[]
}

function normalizeAllowedFields(raw: unknown): Record<ConsentField, boolean> {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const normalized: Record<ConsentField, boolean> = { ...DEFAULT_ALLOWED_FIELDS }
  for (const field of Object.keys(DEFAULT_ALLOWED_FIELDS) as ConsentField[]) {
    const next = source[field]
    if (typeof next === 'boolean') {
      normalized[field] = next
    }
  }
  return normalized
}

export default function ConsentPage() {
  const router = useRouter()
  const [consents, setConsents] = useState<DataConsent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [targetRole, setTargetRole] = useState<ConsentTargetRole>('landlord')
  const [purpose, setPurpose] = useState<ConsentPurpose>('tenant_profile_view')
  const [expiresInDays, setExpiresInDays] = useState('')
  const [allowedFields, setAllowedFields] = useState<Record<ConsentField, boolean>>(DEFAULT_ALLOWED_FIELDS)

  const latestByPair = useMemo(() => {
    const sorted = [...consents].sort(
      (a, b) => new Date(b.consented_at).getTime() - new Date(a.consented_at).getTime()
    )
    const map = new Map<string, DataConsent>()
    for (const consent of sorted) {
      const key = `${consent.target_role}:${consent.purpose}`
      if (!map.has(key)) {
        map.set(key, consent)
      }
    }
    return Array.from(map.values())
  }, [consents])

  useEffect(() => {
    loadConsents()
  }, [])

  const loadConsents = async () => {
    try {
      const response = await fetch('/api/consent')
      const data = (await response.json()) as ConsentResponse

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error((data as { error?: string }).error || '동의 목록 조회 실패')
      }

      setConsents(data.consents)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (key: ConsentField) => {
    setAllowedFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const parsedExpires = Number.parseInt(expiresInDays || '', 10)
      const body: {
        targetRole: ConsentTargetRole
        purpose: ConsentPurpose
        allowedFields: Record<ConsentField, boolean>
        expiresInDays?: number
      } = {
        targetRole,
        purpose,
        allowedFields,
      }

      if (Number.isInteger(parsedExpires) && parsedExpires > 0) {
        body.expiresInDays = parsedExpires
      }

      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || '동의 저장 실패')
      }

      toast.success('동의 설정이 반영되었습니다.')
      setExpiresInDays('')
      await loadConsents()
      return data
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (consent: DataConsent) => {
    if (consent.status !== 'active') return
    setRevokingId(consent.id)
    try {
      const reason = window.prompt('동의 폐기 사유를 입력하세요(선택)')
      const response = await fetch('/api/consent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole: consent.target_role,
          purpose: consent.purpose,
          reason: reason || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: '동의 폐기 실패' }))
        throw new Error(data.error || '동의 폐기 실패')
      }

      toast.success('동의를 폐기했습니다.')
      await loadConsents()
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setRevokingId(null)
    }
  }

  const loadFromLatest = (role: ConsentTargetRole, purposeValue: ConsentPurpose) => {
    const target = latestByPair.find(
      (consent) => consent.target_role === role && consent.purpose === purposeValue && consent.status === 'active'
    )
    if (!target) return
    setTargetRole(role)
    setPurpose(purposeValue)
    setAllowedFields(normalizeAllowedFields(target.allowed_fields))
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">동의 관리</h1>
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">데이터 동의 관리</h1>
          <p className="text-muted-foreground">
            누가 내 정보를 조회할 수 있는지, 어떤 항목을 노출할지 설정합니다.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>동의 등록 / 수정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>조회 대상</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as ConsentTargetRole)}
                >
                  {TARGET_ROLE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>목적</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as ConsentPurpose)}
                >
                  {PURPOSE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="expiresInDays">동의 기간(일)</Label>
              <Input
                id="expiresInDays"
                type="number"
                min="1"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="공란 = 무기한"
              />
            </div>

            <div className="grid gap-2">
              <Label>노출 항목</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {FIELD_OPTIONS.map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allowedFields[field.key]}
                      onChange={() => handleFieldChange(field.key)}
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? '저장 중...' : '동의 적용'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>현재 적용 중인 동의</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestByPair.map((consent) => (
              <div
                key={`${consent.id}-${consent.target_role}-${consent.purpose}`}
                className="border rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <p className="font-medium">
                    {TARGET_ROLE_OPTIONS.find((x) => x.value === consent.target_role)?.label} /{' '}
                    {PURPOSE_OPTIONS.find((x) => x.value === consent.purpose)?.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    상태: <span className={consent.status === 'active' ? 'text-green-600' : ''}>{consent.status}</span>
                    · 버전 {consent.consent_version}
                    · 동의일 {new Date(consent.consented_at).toLocaleString('ko-KR')}
                    {consent.expires_at ? ` · 만료일 ${new Date(consent.expires_at).toLocaleDateString('ko-KR')}` : ''}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2">
                    항목:{' '}
                    {Object.entries(normalizeAllowedFields(consent.allowed_fields))
                      .filter(([, enabled]) => enabled)
                      .map(([field]) => field)
                      .join(', ') || '없음'}
                  </div>
                </div>

                <div className="flex gap-2">
                  {consent.status === 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revokingId === consent.id}
                      onClick={() => handleRevoke(consent)}
                    >
                      {revokingId === consent.id ? '폐기 중...' : '폐기'}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadFromLatest(consent.target_role, consent.purpose)}
                    >
                      재설정
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {latestByPair.length === 0 && <p className="text-sm text-muted-foreground">저장된 동의가 없습니다.</p>}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}

