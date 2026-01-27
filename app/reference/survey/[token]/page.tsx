'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ReferenceSurvey, SurveyData } from '@/components/reference/reference-survey'
import { Home, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function SurveyPage() {
  const params = useParams()
  const router = useRouter()
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
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <Home className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">입주해</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-bold mb-2">오류 발생</h2>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : isCompleted ? (
          <Card className="max-w-md w-full">
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
