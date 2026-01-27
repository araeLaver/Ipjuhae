'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Send, Link as LinkIcon } from 'lucide-react'
import { LandlordReference } from '@/types/database'

interface ReferenceRequestFormProps {
  onSuccess: (reference: LandlordReference, surveyUrl?: string) => void
}

export function ReferenceRequestForm({ onSuccess }: ReferenceRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    landlordName: '',
    landlordPhone: '',
    landlordEmail: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '요청에 실패했습니다')
      }

      onSuccess(data.reference, data.surveyUrl)
      setFormData({ landlordName: '', landlordPhone: '', landlordEmail: '' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          레퍼런스 요청
        </CardTitle>
        <CardDescription>
          이전 집주인에게 레퍼런스 설문을 요청합니다
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="landlordName">집주인 이름 (선택)</Label>
            <Input
              id="landlordName"
              value={formData.landlordName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, landlordName: e.target.value }))
              }
              placeholder="홍길동"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="landlordPhone">집주인 연락처 *</Label>
            <Input
              id="landlordPhone"
              type="tel"
              value={formData.landlordPhone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, landlordPhone: e.target.value }))
              }
              placeholder="010-1234-5678"
              required
            />
            <p className="text-xs text-muted-foreground">
              SMS로 설문 링크가 발송됩니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="landlordEmail">집주인 이메일 (선택)</Label>
            <Input
              id="landlordEmail"
              type="email"
              value={formData.landlordEmail}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, landlordEmail: e.target.value }))
              }
              placeholder="landlord@example.com"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                요청 보내기
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
