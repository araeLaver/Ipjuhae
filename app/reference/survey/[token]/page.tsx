'use client'

import { useEffect, useState } from 'react'
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

export default function SurveyPage() {
  const params = useParams()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [existingResponse, setExistingResponse] = useState<ExistingResponse | null>(null)

  useEffect(() => {
    verifyToken()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const verifyToken = async () => {
    try {
      const res = await fetch(`/api/references/verify/${token}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setTenantName(data.tenantName)
      if (data.completed) {
        setIsCompleted(true)
        setExistingResponse(data.existingResponse ?? null)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (surveyData: SurveyData) => {
    const res = await fetch(`/api/references/verify/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '제출에 실패했습니다')

    setIsCompleted(true)
    toast.success('설문이 완료되었습니다!')
  }

  const handleUpdate = async (surveyData: SurveyData) => {
    const res = await fetch(`/api/references/verify/${token}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '수정에 실패했습니다')

    setExistingResponse(surveyData as unknown as ExistingResponse)
    setIsEditing(false)
    toast.success('설문이 수정되었습니다!')
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
                <h2 className="text-xl font-bold mb-2">오류 발생</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : isCompleted && !isEditing ? (
          <Card className="max-w-md w-full shadow-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h2 className="text-xl font-bold mb-2">설문이 완료되었습니다</h2>
                <p className="text-muted-foreground mb-6">
                  소중한 의견을 공유해 주셔서 감사합니다.
                  <br />
                  {tenantName}님의 신뢰점수에 반영됩니다.
                </p>
                {existingResponse && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    응답 수정하기
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : isEditing && existingResponse ? (
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                ← 취소
              </Button>
              <span className="text-sm text-muted-foreground">응답을 수정합니다</span>
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
