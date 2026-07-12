'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ReferenceSurvey, SurveyData } from '@/components/reference/reference-survey'
import { Header } from '@/components/layout/header'
import { CheckCircle, XCircle, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface ExistingResponse {
  rent_payment: number
  property_condition: number
  neighbor_issues: number
  checkout_condition: number
  would_recommend: boolean
  comment?: string | null
}

interface TokenVerifyResponse {
  valid: boolean
  completed: boolean
  editable: boolean
  editableUntil: string | null
  tenantName: string
  referenceId: string
  existingResponse: ExistingResponse | null
}

export default function SurveyPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditable, setIsEditable] = useState(false)
  const [editableUntil, setEditableUntil] = useState<string | null>(null)
  const [existingResponse, setExistingResponse] = useState<ExistingResponse | null>(null)
  const submitIdempotencyKey = useRef<string | null>(null)
  const updateIdempotencyKey = useRef<string | null>(null)

  useEffect(() => {
    verifyToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const verifyToken = async () => {
    try {
      const res = await fetch(`/api/references/verify/${token}`)
      const data = (await res.json()) as Partial<TokenVerifyResponse> & { error?: string }

      if (!res.ok) throw new Error(data.error ?? '설문 토큰 확인에 실패했습니다')

      setTenantName(data.tenantName ?? '')
      setIsEditable(data.editable ?? false)
      setEditableUntil(data.editableUntil ?? null)

      if (data.completed) {
        setIsCompleted(true)
        setExistingResponse(data.existingResponse ?? null)
        setIsEditing(false)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (surveyData: SurveyData) => {
    const idempotencyKey = submitIdempotencyKey.current ?? crypto.randomUUID()
    submitIdempotencyKey.current = idempotencyKey
    const res = await fetch(`/api/references/verify/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(surveyData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '평가 제출에 실패했습니다')

    submitIdempotencyKey.current = null
    setIsCompleted(true)
    setIsEditable(true)
    toast.success('평가가 접수되었습니다')
  }

  const handleUpdate = async (surveyData: SurveyData) => {
    const idempotencyKey = updateIdempotencyKey.current ?? crypto.randomUUID()
    updateIdempotencyKey.current = idempotencyKey
    const res = await fetch(`/api/references/verify/${token}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(surveyData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '수정에 실패했습니다')

    updateIdempotencyKey.current = null
    setExistingResponse(surveyData as unknown as ExistingResponse)
    setIsEditing(false)
    toast.success('평가가 수정되었습니다')
  }

  const toSurveyData = (r: ExistingResponse): Partial<SurveyData> => ({
    rentPayment: r.rent_payment,
    propertyCondition: r.property_condition,
    neighborIssues: r.neighbor_issues,
    checkoutCondition: r.checkout_condition,
    wouldRecommend: r.would_recommend,
    comment: r.comment ?? '',
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center p-4 animate-fade-in">
        {error ? (
          <Card className="max-w-md w-full shadow-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
                <h2 className="text-xl font-bold mb-2">요청 처리 실패</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : isCompleted && !isEditing ? (
          <Card className="max-w-md w-full shadow-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h2 className="text-xl font-bold mb-2">완료</h2>
                <p className="text-muted-foreground mb-6">
                  세입자에 대한 레퍼런스 평가가 접수되었습니다.
                  <br />
                  {tenantName}님의 정보입니다.
                </p>
                {editableUntil ? (
                  <p className="text-xs text-muted-foreground mb-4">
                    수정 가능 기간: {new Date(editableUntil).toLocaleString()}
                    {isEditable ? ' (현재 수정 가능)' : ' (만료됨)'}
                  </p>
                ) : null}
                {existingResponse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    disabled={!isEditable}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    후속 수정하기
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : isEditing && existingResponse ? (
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <span className="text-sm text-muted-foreground">후속 수정</span>
            </div>
            <ReferenceSurvey
              tenantName={tenantName}
              defaultValues={toSurveyData(existingResponse)}
              onSubmit={handleUpdate}
              submitLabel="수정 완료"
            />
          </div>
        ) : (
          <ReferenceSurvey tenantName={tenantName} onSubmit={handleSubmit} />
        )}
      </main>
    </div>
  )
}
