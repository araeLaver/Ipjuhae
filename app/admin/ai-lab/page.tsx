'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, FileText, ScanText } from 'lucide-react'

export default function AdminAiLabPage() {
  const [question, setQuestion] = useState('')
  const [facts, setFacts] = useState('')
  const [desiredOutcome, setDesiredOutcome] = useState('')
  const [legalAnswer, setLegalAnswer] = useState('')
  const [legalLoading, setLegalLoading] = useState(false)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePrompt, setImagePrompt] = useState('이미지의 문구와 핵심 정보를 한국어로 정확히 추출해 주세요.')
  const [pdfUnlockCode, setPdfUnlockCode] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [selectedFileType, setSelectedFileType] = useState('')

  async function submitLegalize() {
    if (!question.trim()) {
      toast.error('질문을 입력해주세요')
      return
    }

    setLegalLoading(true)
    try {
      const res = await fetch('/api/ai/legalize-kr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, facts, desiredOutcome }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '법률 자문 생성에 실패했습니다')
      }
      setLegalAnswer(data.answer || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '법률 자문 생성에 실패했습니다')
    } finally {
      setLegalLoading(false)
    }
  }

  async function submitOcr() {
    if (!imageFile) {
      toast.error('이미지 파일을 선택해주세요')
      return
    }

    setOcrLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('prompt', imagePrompt)
      if (selectedFileType === 'application/pdf' || imageFile.name.toLowerCase().endsWith('.pdf')) {
        formData.append('pdf_unlock_code', pdfUnlockCode || '')
      }
      formData.append('temperature', '0.1')

      const res = await fetch('/api/image2text', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'OCR 추출에 실패했습니다')
      }
      setOcrText(data.text || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OCR 추출에 실패했습니다')
    } finally {
      setOcrLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Lab</h1>
        <p className="mt-1 text-sm text-gray-500">
          Legalize Kr 법률 검토와 Image-to-Text OCR을 바로 테스트합니다.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Legalize Kr
            </CardTitle>
            <CardDescription>변리사/법률자문용 초안 정리</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">질문</label>
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} placeholder="상표, 서비스, 계약, 운영 리스크 등을 입력" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">사실관계</label>
              <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={4} placeholder="현재 상황, 정리된 사실관계, 제약 조건" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">원하는 결과</label>
              <Input value={desiredOutcome} onChange={(e) => setDesiredOutcome(e.target.value)} placeholder="예: 상표 출원 전략 초안" />
            </div>
            <Button onClick={submitLegalize} disabled={legalLoading} className="w-full">
              {legalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              법률 자문 생성
            </Button>
            <Textarea value={legalAnswer} readOnly rows={12} placeholder="결과가 여기에 표시됩니다" className="font-mono text-sm" />
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanText className="h-4 w-4" />
              Image-to-Text
            </CardTitle>
            <CardDescription>문서 이미지에서 텍스트와 핵심 정보를 추출</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">문서 파일</label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  setImageFile(file)
                  setPdfUnlockCode('')
                  setSelectedFileType(file?.type || '')
                }}
              />
            </div>
            {(selectedFileType === 'application/pdf' || imageFile?.name.toLowerCase().endsWith('.pdf')) ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">PDF 비밀번호</label>
                <Input
                  value={pdfUnlockCode}
                  onChange={(e) => setPdfUnlockCode(e.target.value)}
                  placeholder="암호화된 PDF인 경우 입력 (선택)"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">분석 지시문</label>
              <Textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} rows={4} />
            </div>
            <Button onClick={submitOcr} disabled={ocrLoading} className="w-full">
              {ocrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              OCR 실행
            </Button>
            <Textarea value={ocrText} readOnly rows={12} placeholder="추출 결과가 여기에 표시됩니다" className="font-mono text-sm" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
