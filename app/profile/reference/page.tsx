'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ReferenceRequestForm } from '@/components/reference/reference-request-form'
import { ReferenceStatusCard } from '@/components/reference/reference-status-card'
import { PageContainer } from '@/components/layout/page-container'
import { Users, Info } from 'lucide-react'
import { LandlordReference } from '@/types/database'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'

export default function ReferencePage() {
  const router = useRouter()
  const [references, setReferences] = useState<LandlordReference[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [latestSurveyUrl, setLatestSurveyUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchReferences()
  }, [])

  const fetchReferences = async () => {
    try {
      const response = await fetch('/api/references')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(data.error)
      }

      setReferences(data.references)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuccess = (reference: LandlordReference, surveyUrl?: string) => {
    setReferences((prev) => [reference, ...prev])
    toast.success('레퍼런스 요청이 추가되었습니다.')
    if (surveyUrl) {
      setLatestSurveyUrl(surveyUrl)
    }
  }

  const handleDelete = (id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id))
    toast.success('레퍼런스 요청이 삭제되었습니다.')
  }

  const getSurveyUrl = (reference: LandlordReference) => {
    if (!reference.verification_token) return undefined
    return `${window.location.origin}/reference/survey/${reference.verification_token}`
  }

  const completedCount = references.filter((r) => r.status === 'completed').length
  const pendingCount = references.filter((r) => r.status === 'sent' || r.status === 'pending').length

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">레퍼런스 요청</h1>
          <p className="text-muted-foreground">
            내 프로필 공유와 연동되는 임대인 레퍼런스를 관리합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{completedCount}</p>
                <p className="text-sm text-muted-foreground">완료된 요청</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">대기 요청</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {latestSurveyUrl && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>요청 링크를 확인해보세요</AlertTitle>
            <AlertDescription>
              <p>링크가 생성되면 임대인에게 SMS/이메일로 전달되고, 요청이 진행 중입니다.</p>
            </AlertDescription>
          </Alert>
        )}

        <ReferenceRequestForm onSuccess={handleSuccess} />

        {references.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              레퍼런스 요청 목록
            </h2>
            <div className="space-y-3">
              {references.map((reference) => (
                <ReferenceStatusCard
                  key={reference.id}
                  reference={reference}
                  surveyUrl={getSurveyUrl(reference)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="요청 내역이 없습니다"
            description="아직 요청한 임대인이 없거나 요청이 등록되지 않았습니다."
          />
        )}
      </div>
    </PageContainer>
  )
}

