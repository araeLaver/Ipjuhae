'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ReferenceSurvey, SurveyData } from '@/components/reference/reference-survey'
import { Header } from '@/components/layout/header'
import { CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function SurveyPage() {
  const params = useParams()
  const token = params.token as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)

  useEffect(() => {
    verifyToken()
  }, [token])

  const verifyToken = async () => {
    try {
      const response = await fetch(`/api/references/verify/${token}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      setTenantName(data.tenantName)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (surveyData: SurveyData) => {
    const response = await fetch(`/api/references/verify/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(surveyData),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '제출에 실패했습니다')
    }

    setIsCompleted(true)
    toast.success('설문이 완료되었습니다!')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex flex-col">
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
        ) : isCompleted ? (
          <Card className="max-w-md w-full shadow-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                <h2 className="text-xl font-bold mb-2">설문이 완료되었습니다</h2>
                <p className="text-muted-foreground">
                  소중한 의견을 공유해 주셔서 감사합니다.
                  <br />
                  {tenantName}님의 신뢰점수에 반영됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ReferenceSurvey tenantName={tenantName} onSubmit={handleSubmit} />
        )}
      </main>
    </div>
  )
}
