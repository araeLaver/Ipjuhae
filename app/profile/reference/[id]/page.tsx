'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PageContainer } from '@/components/layout/page-container'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { LandlordReference, ReferenceDispute, ReferenceResponse } from '@/types/database'

interface ReferencePayload {
  reference: LandlordReference
  response: ReferenceResponse | null
  disputes: ReferenceDispute[]
}

function getStatusBadgeColor(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700'
    case 'expired':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-blue-100 text-blue-700'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'completed':
      return '완료'
    case 'sent':
      return '발송됨'
    case 'expired':
      return '만료됨'
    case 'pending':
      return '대기 중'
    default:
      return status
  }
}

function disputeStatusLabel(status: ReferenceDispute['status']) {
  switch (status) {
    case 'reviewing':
      return '검토 중'
    case 'accepted':
      return '수용됨'
    case 'rejected':
      return '반려됨'
    case 'completed':
      return '완료'
    case 'pending':
      return '대기 중'
    case 'corrected':
      return '정정됨'
    case 'withheld':
      return '보류됨'
    case 'deleted':
      return '삭제됨'
  }
}

function disputeStatusClass(status: ReferenceDispute['status']) {
  if (status === 'accepted' || status === 'completed' || status === 'corrected') return 'text-green-700'
  if (status === 'rejected') return 'text-red-700'
  if (status === 'withheld' || status === 'deleted') return 'text-amber-700'
  return 'text-blue-700'
}

export default function ReferenceDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reference, setReference] = useState<LandlordReference | null>(null)
  const [response, setResponse] = useState<ReferenceResponse | null>(null)
  const [disputes, setDisputes] = useState<ReferenceDispute[]>([])
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchDetail()
  }, [id])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/references/${id}`)
      const payload = (await response.json()) as Partial<ReferencePayload & { error?: string }>

      if (!response.ok) {
        setError((payload as { error?: string }).error || '추천서를 불러오지 못했습니다.')
        return
      }

      if (!payload.reference) {
        setError('추천서 데이터를 찾을 수 없습니다.')
        return
      }

      setReference(payload.reference)
      setResponse(payload.response ?? null)
      setDisputes(payload.disputes ?? [])
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const createDispute = async () => {
    if (!reason || !detail) {
      toast.error('사유와 상세 내용을 모두 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/references/${id}/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, detail }),
      })
      const data = (await response.json()) as { dispute?: ReferenceDispute; error?: string }

      if (!response.ok) {
        throw new Error(data.error || '이의 제기 등록에 실패했습니다.')
      }

      setDisputes((prev) => [data.dispute!, ...prev])
      setReason('')
      setDetail('')
      toast.success('이의 제기가 접수되었습니다.')
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageContainer maxWidth="md">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        </div>
      </PageContainer>
    )
  }

  if (error || !reference) {
    return (
      <PageContainer maxWidth="md">
        <p className="text-sm text-destructive">{error || '추천서를 찾을 수 없습니다.'}</p>
        <Link href="/profile/reference" className="inline-block mt-4 text-sm underline">
          목록으로 돌아가기
        </Link>
      </PageContainer>
    )
  }

  const latestDispute = disputes.find((dispute) => dispute.status === 'pending' || dispute.status === 'reviewing')
  const canCreateDispute = !!response && !latestDispute && reference.status === 'completed'

  return (
    <PageContainer maxWidth="md">
      <div className="space-y-6">
        <div className="space-y-2">
          <Link href="/profile/reference" className="text-sm text-muted-foreground underline">
            추천서 목록
          </Link>
          <h1 className="text-2xl font-bold">추천서 상세</h1>
          <p className="text-sm text-muted-foreground">
            {reference.landlord_name || '집주인'} | {reference.landlord_phone}
          </p>
          <p className={`inline-flex rounded-full px-2 py-1 text-xs ${getStatusBadgeColor(reference.status)}`}>
            {statusLabel(reference.status)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>진행 일정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>발송: {new Date(reference.request_sent_at || reference.created_at).toLocaleString('ko-KR')}</p>
            {reference.completed_at && <p>완료: {new Date(reference.completed_at).toLocaleString('ko-KR')}</p>}
            {reference.token_expires_at && (
              <p>만료: {new Date(reference.token_expires_at).toLocaleString('ko-KR')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>추천서 응답</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {response ? (
              <div className="space-y-2">
                <p>임대료 납부: {response.rent_payment} / 5</p>
                <p>매물 상태: {response.property_condition} / 5</p>
                <p>이웃 관련 문제: {response.neighbor_issues} / 5</p>
                <p>퇴거 시 상태: {response.checkout_condition} / 5</p>
                <p>추천 여부: {response.would_recommend ? '예' : '아니오'}</p>
                {response.comment ? <p className="text-muted-foreground">코멘트: {response.comment}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">아직 응답이 없습니다.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>이의 제기 내역</CardTitle>
            {response ? (
              canCreateDispute ? (
                <span className="text-xs text-green-700">이의 제기가 가능합니다.</span>
              ) : (
                <span className="text-xs text-muted-foreground">이 응답에는 이의 제기를 할 수 없습니다.</span>
              )
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {disputes.length > 0 ? (
              disputes.map((dispute) => (
                <div key={dispute.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">{dispute.reason}</p>
                    <span className={`text-xs ${disputeStatusClass(dispute.status)}`}>
                      {disputeStatusLabel(dispute.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{dispute.detail}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    요청 일시 {new Date(dispute.created_at).toLocaleString('ko-KR')}
                  </p>
                  {dispute.review_comment && (
                    <p className="text-xs text-muted-foreground mt-1">검토자 코멘트: {dispute.review_comment}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">등록된 이의 제기가 없습니다.</p>
            )}
          </CardContent>
        </Card>

        {canCreateDispute ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">이의 제기 등록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>사유</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>상세 내용</Label>
                <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={6} />
              </div>
              <Button onClick={createDispute} disabled={submitting}>
                {submitting ? '제출 중...' : '이의 제기 제출'}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageContainer>
  )
}
