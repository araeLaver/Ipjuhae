'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  parseRegistryText,
  type RegistryParseResult,
} from '@/lib/registry-parser'
import { manwon } from '@/lib/deposit-risk'

interface RegistryQuickImportProps {
  onApplyMortgage: (mortgageMaxManwon: number) => void
  onFlagsDetected?: (result: RegistryParseResult) => void
}

export function RegistryQuickImport({
  onApplyMortgage,
  onFlagsDetected,
}: RegistryQuickImportProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<RegistryParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleParseText() {
    setError('')
    const result = parseRegistryText(rawText)
    setParsed(result)
    onFlagsDetected?.(result)
    if (result.mortgageMaxManwon > 0) {
      onApplyMortgage(result.mortgageMaxManwon)
    }
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/check/parse-registry', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.result) {
        setError(
          data?.error ??
            '이미지를 분석하지 못했습니다. 텍스트 붙여넣기 탭을 이용해 주세요.'
        )
        return
      }
      const result = data.result as RegistryParseResult
      setParsed(result)
      onFlagsDetected?.(result)
      if (result.mortgageMaxManwon > 0) {
        onApplyMortgage(result.mortgageMaxManwon)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 텍스트 붙여넣기는 서버 전송 없이 바로 동작합니다.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section
      className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4"
      aria-label="등기부등본 자동 채우기"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">
            등기부등본 읽기 어려우신가요? 10초 자동 채우기
          </p>
          <p className="text-xs text-muted-foreground">
            을구 채권최고액 합계와 신탁·압류·가압류·경매 위험 신호를 자동으로 찾아드립니다.
          </p>
        </div>
        <Button
          type="button"
          variant={open ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '접기' : '등기부 자동 분석 열기'}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 border-t border-primary/15 pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'text' ? 'default' : 'outline'}
              onClick={() => {
                setMode('text')
                setError('')
              }}
            >
              텍스트 붙여넣기 (서버 전송 없음)
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'image' ? 'default' : 'outline'}
              onClick={() => {
                setMode('image')
                setError('')
              }}
            >
              캡처 사진 AI 분석
            </Button>
          </div>

          {mode === 'text' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                인터넷등기소 PDF나 화면의 갑구·을구 내용을 복사해 붙여넣으세요. 브라우저 안에서만
                계산되며 서버로 보내지 않습니다.
              </p>
              <Textarea
                aria-label="등기부등본 갑구·을구 텍스트"
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="예: 1 근저당권설정 채권최고액 금 180,000,000원 근저당권자 ○○은행"
              />
              <Button
                type="button"
                size="sm"
                disabled={!rawText.trim()}
                onClick={handleParseText}
              >
                채권최고액·위험신호 추출하기
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                등기부등본 갑구·을구 캡처 사진(PNG/JPG/WEBP, 5MB 이하)을 올리면 AI가 채권최고액과
                위험 신호만 추출합니다. 이미지와 개인정보는 저장하지 않습니다.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                aria-label="등기부등본 캡처 이미지 선택"
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                onChange={(e) => void handleImageUpload(e.target.files?.[0])}
              />
              {busy ? (
                <p role="status" className="text-xs font-medium text-primary">
                  등기부등본 이미지를 분석하는 중입니다...
                </p>
              ) : null}
            </div>
          )}

          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          {parsed ? (
            <div className="space-y-2 rounded-md border bg-background p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">추출된 근저당 채권최고액 합계</span>
                <span className="font-bold text-primary tabular-nums">
                  {manwon(parsed.mortgageMaxManwon)}
                </span>
              </div>

              {parsed.flags.length > 0 ? (
                <div className="space-y-1.5 rounded-md border border-red-200 bg-red-50 p-2.5 text-red-800">
                  <p className="font-bold">
                    갑구·을구 위험 신호 {parsed.flags.length}건 감지됨
                  </p>
                  <ul className="space-y-1">
                    {parsed.flags.map((f) => (
                      <li key={f.code}>
                        <strong className="mr-1">[{f.label}]</strong>
                        {f.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-emerald-700">
                  입력된 내용에서 신탁·압류·가압류·경매·임차권등기 키워드는 감지되지 않았습니다.
                </p>
              )}

              {parsed.notes.map((note, idx) => (
                <p key={idx} className="text-muted-foreground">
                  • {note}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
