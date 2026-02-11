'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, Briefcase, DollarSign, CreditCard, Loader2 } from 'lucide-react'
import { DocumentUpload } from '@/components/verification/document-upload'
import { useVerificationStatus } from '@/hooks/useVerificationStatus'
import { Verification } from '@/types/database'

interface VerificationCardWithUploadProps {
  type: 'employment' | 'income' | 'credit'
  verification: Verification | null
  onVerified: (updated: Verification) => void
}

const cardConfig = {
  employment: {
    icon: Briefcase,
    title: '재직 인증',
    description: '현재 근무 중인 회사 정보를 인증합니다',
    points: '+25점',
    docLabel: '재직증명서',
  },
  income: {
    icon: DollarSign,
    title: '소득 인증',
    description: '연간 소득 구간을 인증합니다',
    points: '+25점',
    docLabel: '소득금액증명원',
  },
  credit: {
    icon: CreditCard,
    title: '신용 인증',
    description: '신용등급을 조회하여 인증합니다',
    points: '+10~20점',
    docLabel: '신용등급확인서',
  },
}

const incomeRanges = ['3000만원 미만', '3000-5000만원', '5000-7000만원', '7000만원 이상']

const creditGradeLabels: Record<number, string> = {
  1: '최우량',
  2: '양호',
  3: '보통',
}

type TabType = 'direct' | 'document'

export function VerificationCardWithUpload({ type, verification, onVerified }: VerificationCardWithUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [company, setCompany] = useState('')
  const [incomeRange, setIncomeRange] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('direct')
  const [docId, setDocId] = useState<string | null>(null)

  const { status: docStatus } = useVerificationStatus(docId)

  const config = cardConfig[type]
  const Icon = config.icon

  const isVerified = verification
    ? type === 'employment'
      ? verification.employment_verified
      : type === 'income'
      ? verification.income_verified
      : verification.credit_verified
    : false

  // Auto-complete when document approved
  if (docStatus === 'approved' && !isVerified) {
    // Refetch verification data
    fetch('/api/verifications').then(res => res.json()).then(data => {
      if (data.verification) onVerified(data.verification)
    })
  }

  const handleVerify = async () => {
    setIsLoading(true)
    setError('')

    try {
      let body: Record<string, string> = {}
      if (type === 'employment') {
        if (!company.trim()) {
          setError('회사명을 입력해주세요')
          setIsLoading(false)
          return
        }
        body = { company }
      } else if (type === 'income') {
        if (!incomeRange) {
          setError('소득 구간을 선택해주세요')
          setIsLoading(false)
          return
        }
        body = { incomeRange }
      }

      const response = await fetch(`/api/verifications/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '인증에 실패했습니다')

      onVerified(data.verification)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className={isVerified ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isVerified ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
              <Icon className={`h-5 w-5 ${isVerified ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {config.title}
                {isVerified && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
              </CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <span className={`text-sm font-medium ${isVerified ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {config.points}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isVerified ? (
          <div className="text-sm text-green-700 dark:text-green-300">
            {type === 'employment' && verification?.employment_company && (
              <p>인증된 회사: {verification.employment_company}</p>
            )}
            {type === 'income' && verification?.income_range && (
              <p>인증된 소득: {verification.income_range}</p>
            )}
            {type === 'credit' && verification?.credit_grade && (
              <p>신용 등급: {creditGradeLabels[verification.credit_grade]}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tab switcher */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveTab('direct')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'direct'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                직접 입력
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('document')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'document'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                서류 제출
              </button>
            </div>

            {activeTab === 'direct' ? (
              <div className="space-y-4">
                {error && <p className="text-sm text-red-600">{error}</p>}

                {type === 'employment' && (
                  <div className="space-y-2">
                    <Label htmlFor="company">회사명</Label>
                    <Input
                      id="company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="회사명을 입력해주세요"
                    />
                  </div>
                )}

                {type === 'income' && (
                  <div className="space-y-2">
                    <Label>연간 소득</Label>
                    <Select value={incomeRange} onValueChange={setIncomeRange}>
                      <SelectTrigger>
                        <SelectValue placeholder="소득 구간을 선택해주세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeRanges.map((range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {type === 'credit' && (
                  <p className="text-sm text-muted-foreground">
                    버튼을 클릭하면 신용등급이 자동으로 조회됩니다. (Mock)
                  </p>
                )}

                <Button onClick={handleVerify} disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '인증하기'}
                </Button>
              </div>
            ) : (
              <DocumentUpload
                type={type}
                label={config.docLabel}
                onUploaded={(id) => setDocId(id)}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
