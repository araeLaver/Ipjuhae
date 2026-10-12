'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CANDIDATES_KEY,
  decodeCandidates,
  encodeCandidates,
  type CheckCandidate,
} from '@/lib/check-candidates'
import { candidateSummary } from '@/lib/candidate-summary'
import { track } from '@/lib/analytics-client'
import { getAttribution } from '@/lib/attribution'

export function CandidateBackup({
  items,
  onRestored,
}: {
  items: CheckCandidate[]
  onRestored: () => void
}) {
  const [pending, setPending] = useState<CheckCandidate[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  function download(kind: 'summary' | 'backup') {
    try {
      const current = decodeCandidates(localStorage.getItem(CANDIDATES_KEY))
      if (!current.length) throw Error('저장한 후보가 없습니다.')
      const blob = new Blob(
        [
          kind === 'backup'
            ? encodeCandidates(current)
            : candidateSummary(current),
        ],
        {
          type:
            kind === 'backup'
              ? 'application/json;charset=utf-8'
              : 'text/plain;charset=utf-8',
        },
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download =
        kind === 'backup'
          ? 'ipjuhae-candidates.json'
          : 'ipjuhae-contract-summary.txt'
      link.click()
      if (kind === 'summary')
        track('check_summary_requested', {
          properties: { surface: 'web', ...getAttribution() },
        })
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
      setNotice('파일 저장을 요청했습니다. 다운로드 폴더를 확인해주세요.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 만들지 못했습니다.')
    }
  }
  async function select(file?: File) {
    setPending(null)
    setError('')
    setNotice('')
    if (!file) return
    try {
      if (file.size > 64000)
        throw Error('후보 백업 파일은 64KB 이하만 복원할 수 있습니다.')
      const next = decodeCandidates(await file.text())
      if (!next.length) throw Error('백업 파일에 후보가 없습니다.')
      setPending(next)
    } catch {
      setError(
        '복원할 수 없는 백업 파일입니다. 기존 후보는 변경하지 않았습니다.',
      )
    }
  }
  function restore() {
    if (!pending) return
    try {
      localStorage.setItem(CANDIDATES_KEY, encodeCandidates(pending))
      onRestored()
      track('check_backup_restored', {
        properties: { surface: 'web', ...getAttribution() },
      })
      setPending(null)
      setError('')
      setNotice('후보와 확인 기록을 이 브라우저에 복원했습니다.')
    } catch {
      setError(
        '복원 내용을 저장하지 못했습니다. 기존 후보를 다시 확인해주세요.',
      )
    }
  }
  return (
    <section
      className="space-y-3 rounded-lg border p-4"
      aria-label="계약 준비 기록 보관"
    >
      <h3 className="font-semibold">계약 준비 기록 가져가기</h3>
      <p className="text-sm text-muted-foreground">
        준비 기록은 상담·집 보기 전에 읽을 수 있는 텍스트로 저장하세요. 백업
        파일을 다른 브라우저에서 열면 후보와 확인 기록을 이어볼 수 있습니다.
        파일에는 입력 금액과 후보 별칭이 포함됩니다. 보관·전달할 위치를 직접
        확인해주세요.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!items.length}
          onClick={() => download('summary')}
        >
          준비 기록 내려받기
        </Button>
        <Button
          variant="outline"
          disabled={!items.length}
          onClick={() => download('backup')}
        >
          후보 백업 내려받기
        </Button>
      </div>
      <label className="block space-y-2 text-sm">
        <span>후보 백업 파일 선택</span>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void select(event.target.files?.[0])
            event.target.value = ''
          }}
          className="block max-w-full"
        />
      </label>
      {pending && (
        <div className="space-y-2 rounded-lg border p-3">
          <p>
            {pending.length}개 후보로 이 브라우저의 기존 후보를 교체할까요? 기존
            후보를 남기려면 먼저 백업을 내려받으세요.
          </p>
          <Button onClick={restore}>기존 후보를 교체하고 복원</Button>
          <Button variant="outline" onClick={() => setPending(null)}>
            취소
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  )
}
