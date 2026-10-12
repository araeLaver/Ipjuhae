'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
interface Applicant {
  id: string
  email: string
  user_type: string
  created_at: string
  invited_at: string | null
  signed_up_at: string | null
}
interface Feedback {
  id: string
  message: string
  contact: string | null
  user_type: string | null
  created_at: string
}
export default function InquiriesPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [total, setTotal] = useState<number | null>(null)
  const load = useCallback(async (start = 0) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    setLoading(true)
    const results = await Promise.allSettled([
      fetch(`/api/admin/waitlist?status=all&limit=50&offset=${start}`, {
        cache: 'no-store',
        signal: controller.signal,
      }).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw Error(data.error || '신청 조회 실패')
        return data
      }),
      fetch('/api/admin/feature-requests', {
        cache: 'no-store',
        signal: controller.signal,
      }).then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw Error(data.error || '의견 조회 실패')
        return data
      }),
    ])
    const nextErrors: Record<string, string> = {}
    const waiting = results[0],
      requests = results[1]
    if (waiting.status === 'fulfilled') {
      setApplicants((current) =>
        start
          ? [...current, ...waiting.value.waitlist]
          : waiting.value.waitlist,
      )
      setTotal(waiting.value.stats.total)
      setMore(waiting.value.waitlist.length === 50)
      setOffset(start + waiting.value.waitlist.length)
    } else
      nextErrors.applicants =
        waiting.reason instanceof Error
          ? waiting.reason.message
          : '신청 목록을 확인하지 못했습니다.'
    if (requests.status === 'fulfilled') setFeedback(requests.value.requests)
    else
      nextErrors.feedback =
        requests.reason instanceof Error
          ? requests.reason.message
          : '의견 목록을 확인하지 못했습니다.'
    clearTimeout(timer)
    setErrors(nextErrors)
    setLoading(false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  const role = (value: string | null) =>
    value === 'tenant'
      ? '세입자'
      : value === 'landlord'
        ? '집주인'
        : value === 'broker'
          ? '중개사'
          : '미지정'
  const date = (value: string) =>
    new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  return (
    <div className="max-w-5xl space-y-6 break-words">
      <h1 className="text-2xl font-bold">신청·고객 의견</h1>
      <p className="text-sm text-muted-foreground">
        접수된 신청과 사용 중 막힌 점을 확인합니다. 신청 수는 실제 이용자·유료
        고객 수가 아닙니다. 테스트 신청 여부와 현재 이용 의향을 확인한 뒤
        안내하세요.
      </p>
      <Button variant="outline" disabled={loading} onClick={() => load()}>
        목록 다시 확인
      </Button>
      {loading && <p role="status">목록을 확인하고 있습니다.</p>}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          사전 신청 {total === null ? '' : `${total}건`}
        </h2>
        {errors.applicants && (
          <p role="alert">{errors.applicants} 이전에 읽은 목록은 유지합니다.</p>
        )}
        {!loading && !errors.applicants && !applicants.length && (
          <p>접수된 신청이 없습니다.</p>
        )}
        <ul className="space-y-3">
          {applicants.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border bg-white p-4 space-y-2"
            >
              <h3 className="font-semibold">
                {role(item.user_type)} · {item.email}
              </h3>
              <p className="text-sm">신청 {date(item.created_at)}</p>
              {/^[^\s@<>?,;]+@[^\s@<>?,;]+\.[^\s@<>?,;]+$/.test(item.email) && (
                <a
                  className="inline-block text-sm font-semibold text-primary underline"
                  href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent('입주해 신청 후 이용 안내')}`}
                >
                  안내 메일 작성
                </a>
              )}
              <p className="text-sm">
                {item.signed_up_at
                  ? `가입 기록 ${date(item.signed_up_at)}`
                  : item.invited_at
                    ? `초대 기록 ${date(item.invited_at)}`
                    : '가입·초대 기록 없음'}
              </p>
              <p className="text-sm text-muted-foreground">
                신청 목적 범위에서 이용 의향을 확인하세요. 이메일로 들어온
                회신과 별도 고객 문의는 메일함에서도 확인해야 합니다.
              </p>
            </li>
          ))}
        </ul>
        {more && (
          <Button
            disabled={loading}
            variant="outline"
            onClick={() => load(offset)}
          >
            다음 신청 50개 보기
          </Button>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">사용 중 접수한 의견</h2>
        {errors.feedback && (
          <p role="alert">{errors.feedback} 이전에 읽은 목록은 유지합니다.</p>
        )}
        {!loading && !errors.feedback && !feedback.length && (
          <p>접수된 의견이 없습니다.</p>
        )}
        <ul className="space-y-3">
          {feedback.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border bg-white p-4 space-y-2"
            >
              <p className="whitespace-pre-wrap">{item.message}</p>
              <p className="text-sm">
                {role(item.user_type)} · {date(item.created_at)}
              </p>
              <p className="text-sm">
                회신 연락처: {item.contact || '남기지 않음'}
              </p>
            </li>
          ))}
        </ul>
        {feedback.length === 200 && (
          <p className="text-sm">
            최근 200개까지 표시합니다. 전체 의견 수가 아닙니다.
          </p>
        )}
      </section>
    </div>
  )
}
