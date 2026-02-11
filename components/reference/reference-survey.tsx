'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Star, ThumbsUp, ThumbsDown } from 'lucide-react'

interface ReferenceSurveyProps {
  tenantName: string
  onSubmit: (data: SurveyData) => Promise<void>
}

export interface SurveyData {
  rentPayment: number
  propertyCondition: number
  neighborIssues: number
  checkoutCondition: number
  wouldRecommend: boolean
  comment: string
}

const questions = [
  {
    id: 'rentPayment',
    title: '월세 납부',
    description: '월세를 제때 납부했나요?',
  },
  {
    id: 'propertyCondition',
    title: '집 관리 상태',
    description: '거주 중 집을 깨끗하게 관리했나요?',
  },
  {
    id: 'neighborIssues',
    title: '이웃 문제',
    description: '이웃과의 마찰 없이 생활했나요?',
  },
  {
    id: 'checkoutCondition',
    title: '퇴실 상태',
    description: '퇴실 시 집 상태가 양호했나요?',
  },
]

function RatingSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`p-2 rounded-lg border transition-colors ${
            value >= rating
              ? 'bg-yellow-100 border-yellow-300 text-yellow-600 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-400'
              : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <Star className={`h-5 w-5 ${value >= rating ? 'fill-yellow-500' : ''}`} />
        </button>
      ))}
    </div>
  )
}

export function ReferenceSurvey({ tenantName, onSubmit }: ReferenceSurveyProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<SurveyData>({
    rentPayment: 0,
    propertyCondition: 0,
    neighborIssues: 0,
    checkoutCondition: 0,
    wouldRecommend: true,
    comment: '',
  })

  const handleRatingChange = (id: string, value: number) => {
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // 유효성 검사
    const scores = [
      formData.rentPayment,
      formData.propertyCondition,
      formData.neighborIssues,
      formData.checkoutCondition,
    ]

    if (scores.some((score) => score === 0)) {
      setError('모든 항목을 평가해주세요')
      setIsLoading(false)
      return
    }

    try {
      await onSubmit(formData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>세입자 평가</CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{tenantName}</span>님에 대한
          경험을 공유해주세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 rounded-md">
              {error}
            </div>
          )}

          {/* 평점 질문들 */}
          {questions.map((question) => (
            <div key={question.id} className="space-y-2">
              <Label className="text-base font-medium">{question.title}</Label>
              <p className="text-sm text-muted-foreground">{question.description}</p>
              <RatingSelector
                value={formData[question.id as keyof SurveyData] as number}
                onChange={(value) => handleRatingChange(question.id, value)}
              />
            </div>
          ))}

          {/* 추천 여부 */}
          <div className="space-y-3">
            <Label className="text-base font-medium">다른 집주인에게 추천하시겠습니까?</Label>
            <RadioGroup
              value={formData.wouldRecommend ? 'yes' : 'no'}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, wouldRecommend: value === 'yes' }))
              }
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="recommend-yes" />
                <Label htmlFor="recommend-yes" className="flex items-center gap-1 cursor-pointer">
                  <ThumbsUp className="h-4 w-4 text-green-600" />
                  예, 추천합니다
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="recommend-no" />
                <Label htmlFor="recommend-no" className="flex items-center gap-1 cursor-pointer">
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  아니요
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 코멘트 */}
          <div className="space-y-2">
            <Label htmlFor="comment">추가 의견 (선택)</Label>
            <Textarea
              id="comment"
              value={formData.comment}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, comment: e.target.value }))
              }
              placeholder="세입자에 대한 추가적인 의견이 있으시면 작성해주세요"
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              '제출하기'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
