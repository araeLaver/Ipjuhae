'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Clock, CheckCircle, XCircle, Send, Trash2, Loader2, ExternalLink } from 'lucide-react'
import { LandlordReference } from '@/types/database'

interface ReferenceStatusCardProps {
  reference: LandlordReference
  surveyUrl?: string
  onDelete: (id: string) => void
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: {
    label: '대기 중',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: Clock,
  },
  sent: {
    label: '발송됨',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    icon: Send,
  },
  completed: {
    label: '완료',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    icon: CheckCircle,
  },
  expired: {
    label: '만료됨',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    icon: XCircle,
  },
}

export function ReferenceStatusCard({ reference, surveyUrl, onDelete }: ReferenceStatusCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const config = statusConfig[reference.status] || statusConfig.pending
  const StatusIcon = config.icon

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/references/${reference.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onDelete(reference.id)
      }
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {reference.landlord_name || '집주인'}
            </CardTitle>
            <CardDescription>{reference.landlord_phone}</CardDescription>
          </div>
          <Badge className={`${config.color} border-0`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>요청일</span>
            <span>{formatDate(reference.request_sent_at || reference.created_at)}</span>
          </div>
          {reference.completed_at && (
            <div className="flex justify-between text-muted-foreground">
              <span>완료일</span>
              <span>{formatDate(reference.completed_at)}</span>
            </div>
          )}
          {reference.token_expires_at && reference.status !== 'completed' && (
            <div className="flex justify-between text-muted-foreground">
              <span>만료일</span>
              <span>{formatDate(reference.token_expires_at)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {surveyUrl && reference.status !== 'completed' && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => window.open(surveyUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              설문 링크
            </Button>
          )}

          {reference.status !== 'completed' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>요청을 취소하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 작업은 되돌릴 수 없습니다. 레퍼런스 요청이 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      '삭제'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
