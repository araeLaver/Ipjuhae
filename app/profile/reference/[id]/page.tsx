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
      return 'Completed'
    case 'sent':
      return 'Sent'
    case 'expired':
      return 'Expired'
    case 'pending':
      return 'Pending'
    default:
      return status
  }
}

function disputeStatusLabel(status: ReferenceDispute['status']) {
  switch (status) {
    case 'reviewing':
      return 'Reviewing'
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    case 'completed':
      return 'Completed'
    case 'pending':
      return 'Pending'
    case 'corrected':
      return 'Corrected'
    case 'withheld':
      return 'Withheld'
    case 'deleted':
      return 'Deleted'
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
        setError((payload as { error?: string }).error || 'Failed to load reference.')
        return
      }

      if (!payload.reference) {
        setError('Reference data not found.')
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
      toast.error('Please fill in both reason and detail.')
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
        throw new Error(data.error || 'Failed to create appeal.')
      }

      setDisputes((prev) => [data.dispute!, ...prev])
      setReason('')
      setDetail('')
      toast.success('Appeal request submitted.')
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
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </PageContainer>
    )
  }

  if (error || !reference) {
    return (
      <PageContainer maxWidth="md">
        <p className="text-sm text-destructive">{error || 'Reference not found.'}</p>
        <Link href="/profile/reference" className="inline-block mt-4 text-sm underline">
          Back to list
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
            Reference list
          </Link>
          <h1 className="text-2xl font-bold">Reference details</h1>
          <p className="text-sm text-muted-foreground">
            {reference.landlord_name || 'Landlord'} | {reference.landlord_phone}
          </p>
          <p className={`inline-flex rounded-full px-2 py-1 text-xs ${getStatusBadgeColor(reference.status)}`}>
            {statusLabel(reference.status)}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Sent: {new Date(reference.request_sent_at || reference.created_at).toLocaleString('en-US')}</p>
            {reference.completed_at && <p>Completed: {new Date(reference.completed_at).toLocaleString('en-US')}</p>}
            {reference.token_expires_at && (
              <p>Expires: {new Date(reference.token_expires_at).toLocaleString('en-US')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reference response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {response ? (
              <div className="space-y-2">
                <p>Rent payment: {response.rent_payment} / 5</p>
                <p>Property condition: {response.property_condition} / 5</p>
                <p>Neighbor issues: {response.neighbor_issues} / 5</p>
                <p>Checkout condition: {response.checkout_condition} / 5</p>
                <p>Would recommend: {response.would_recommend ? 'Yes' : 'No'}</p>
                {response.comment ? <p className="text-muted-foreground">Comment: {response.comment}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No response yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Appeal history</CardTitle>
            {response ? (
              canCreateDispute ? (
                <span className="text-xs text-green-700">Appeal can be requested.</span>
              ) : (
                <span className="text-xs text-muted-foreground">Appeal is not available for this response.</span>
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
                    Requested at {new Date(dispute.created_at).toLocaleString('en-US')}
                  </p>
                  {dispute.review_comment && (
                    <p className="text-xs text-muted-foreground mt-1">Reviewer comment: {dispute.review_comment}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No appeal has been registered.</p>
            )}
          </CardContent>
        </Card>

        {canCreateDispute ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Register appeal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Detail</Label>
                <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={6} />
              </div>
              <Button onClick={createDispute} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit appeal'}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageContainer>
  )
}
