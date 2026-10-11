'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CANDIDATES_KEY, decodeCandidates } from '@/lib/check-candidates'
import {
  QUESTION_KEY,
  QUESTION_CHANGED,
  readQuestions,
} from '@/lib/community-follow-up'

/** Local progress makes returning useful without requiring an account or uploading inputs. */
export function HomeReturnLinks() {
  const [progress, setProgress] = useState({
    candidates: 0,
    remaining: 0,
    questions: 0,
    unavailable: false,
  })
  useEffect(() => {
    const read = () => {
      let candidates = 0,
        remaining = 0,
        questions = 0,
        unavailable = false
      try {
        const items = decodeCandidates(localStorage.getItem(CANDIDATES_KEY))
        candidates = items.length
        remaining = items.reduce(
          (sum, item) => sum + item.checked.filter((value) => !value).length,
          0,
        )
      } catch {
        unavailable = true
      }
      try {
        questions = readQuestions(localStorage.getItem(QUESTION_KEY)).length
      } catch {
        unavailable = true
      }
      setProgress({ candidates, remaining, questions, unavailable })
    }
    const storage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === CANDIDATES_KEY ||
        event.key === QUESTION_KEY
      )
        read()
    }
    const visible = () => {
      if (!document.hidden) read()
    }
    read()
    window.addEventListener('storage', storage)
    window.addEventListener('focus', read)
    window.addEventListener(QUESTION_CHANGED, read)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', read)
      window.removeEventListener(QUESTION_CHANGED, read)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])
  return (
    <nav
      aria-label="내 계약 준비 이어보기"
      className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm"
    >
      <Link
        href="/check#candidates"
        className="inline-flex min-h-11 items-center font-semibold text-primary"
      >
        {progress.candidates
          ? `내 후보 ${progress.candidates}개 · 남은 확인 ${progress.remaining}개`
          : '저장한 후보 이어보기'}{' '}
        →
      </Link>
      <Link
        href="/community#follow-up"
        className="inline-flex min-h-11 items-center font-semibold text-primary"
      >
        {progress.questions
          ? `보관한 질문 ${progress.questions}개 · 답변 확인`
          : '내 질문 답변 확인'}{' '}
        →
      </Link>
      {progress.unavailable && (
        <span className="text-xs text-muted-foreground">
          기기 저장 내용을 읽지 못했습니다. 각 화면에서 다시 확인해 주세요.
        </span>
      )}
      {(progress.candidates > 0 || progress.questions > 0) && (
        <span className="text-xs text-muted-foreground">
          이 브라우저에 저장한 기록입니다.
        </span>
      )}
    </nav>
  )
}
