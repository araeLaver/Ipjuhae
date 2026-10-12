import Link from 'next/link'
import { serviceOperations } from '@/lib/service-operations'
import { getAdminUser } from '@/lib/admin'
import { redirect } from 'next/navigation'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: '서비스 운영·수익',
  robots: { index: false, follow: false },
}
export default async function OperationsPage() {
  if (!(await getAdminUser())) redirect('/login')
  const state = await serviceOperations()
  const questions = state.questions.data?.[0]
  const subscriptions = state.subscriptions.data?.[0]
  const policyCount =
    state.policy.data && 'count' in state.policy.data
      ? state.policy.data.count
      : 0
  const labels: Record<string, string> = {
    check_started: '점검 시작',
    check_result_viewed: '결과 확인',
    check_candidate_saved: '후보 저장',
    check_comparison_viewed: '후보 비교',
    check_next_action_clicked: '다음 행동 클릭',
    check_summary_requested: '준비 기록 요청',
    check_backup_restored: '백업 복원',
    check_link_copied: '점검 링크 복사',
  }
  return (
    <div className="max-w-5xl space-y-7 break-words">
      <h1 className="text-2xl font-bold">서비스 운영·수익</h1>
      <p className="text-sm text-muted-foreground">
        확인{' '}
        {new Date(state.checkedAt).toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
        })}{' '}
        ·{' '}
        <Link className="underline" href="/admin/operations">
          다시 확인
        </Link>
      </p>
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="text-lg font-bold">먼저 처리할 일</h2>
        <ul className="space-y-2">
          <li>
            {!state.questions.available
              ? '질문 현황 조회 실패 — 답변 대기 목록을 다시 확인하세요.'
              : `답변 대기 ${questions?.waiting || '0'}건 · 24시간 이상 ${questions?.overdue || '0'}건`}{' '}
            ·{' '}
            <Link className="underline" href="/admin/community">
              질문 확인·답변
            </Link>
          </li>
          <li>
            {!state.policy.available
              ? '정책소식 상태 조회 실패'
              : state.policy.data?.status === 'ok'
                ? `정책소식 정상 · ${policyCount}건`
                : '정책소식 지연 — 수집 작업과 오류를 확인하세요.'}{' '}
            ·{' '}
            <Link className="underline" href="/policy/news">
              소식 화면
            </Link>
          </li>
          <li>
            {state.billing.ready
              ? '결제 연결 설정 있음 — 실제 결제·웹훅·해지 검증 결과는 별도 확인해야 합니다.'
              : `유료 결제 연결 미완료: ${state.billing.missing.join(', ')}`}
          </li>
        </ul>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="text-lg font-bold">첫 사용 · 최근 7일</h2>
        <p className="text-sm text-muted-foreground">
          익명 행동 횟수입니다. 고유 사용자·전환율·재방문율이 아닙니다.
        </p>
        {!state.activity.available ? (
          <p role="alert">
            이용 집계를 불러오지 못했습니다. 0으로 판단하지 마세요.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {Object.entries(labels).map(([event, label]) => (
              <div key={event}>
                <dt className="text-sm">{label}</dt>
                <dd className="text-2xl font-bold">
                  {state.activity.data?.find((row) => row.event_name === event)
                    ?.count || '0'}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <Link className="inline-block underline" href="/admin/analytics">
          날짜별 이용 분석
        </Link>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="text-lg font-bold">유료 이용과 결제</h2>
        {!state.subscriptions.available ? (
          <p role="alert">구독 집계를 불러오지 못했습니다.</p>
        ) : (
          <p>
            활성 유료 구독 기록 {subscriptions?.billed || '0'}건 · 결제 참조
            없는 유료 권한 {subscriptions?.unbilled || '0'}건
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          구독 기록은 실제 수납액과 다릅니다. 결제 참조 없는 권한은 무료
          제공·데모 이력 여부를 확인하세요.
        </p>
        {!state.revenue.available ? (
          <p role="alert">
            이번 달 결제 완료액을 확인하지 못했습니다. 결제 업체 연결과 내역을
            확인하세요.
          </p>
        ) : (
          <>
            <p>
              {state.revenue.data?.month} 결제 완료 청구서{' '}
              {state.revenue.data?.count}건
              {state.revenue.data?.partial ? ' · 일부 조회' : ''}
            </p>
            <ul>
              {Object.entries(state.revenue.data?.totals || {}).map(
                ([currency, value]) => (
                  <li key={currency} className="font-bold">
                    {currency.toUpperCase()}{' '}
                    {new Intl.NumberFormat('ko-KR', {
                      style: 'currency',
                      currency,
                    }).format(
                      value /
                        (currency.toLowerCase() === 'krw' ||
                        currency.toLowerCase() === 'jpy'
                          ? 1
                          : 100),
                    )}
                  </li>
                ),
              )}
            </ul>
            {!Object.keys(state.revenue.data?.totals || {}).length && (
              <p>조회 범위에 결제 완료액이 없습니다.</p>
            )}
            {state.revenue.data?.partial && (
              <p role="alert">
                최대 500개 청구서 범위만 조회했습니다. 표시액을 월 전체 금액으로
                판단하지 마세요.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              결제 완료 청구액이며 환불·수수료를 차감하지 않았습니다. 정산금이나
              이익이 아닙니다.
            </p>
          </>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">첫 고객 운영</h2>
        <p>
          <Link className="underline" href="/admin/inquiries">
            접수된 신청·고객 의견 확인
          </Link>
        </p>
        <p className="text-sm">
          집을 찾는 대상자에게 공유 링크를 안내하고 점검→후보 저장→질문→응대
          결과를 확인하세요. 이용자를 확보했다는 판단은 실제 이용 기록과 함께
          합니다.
        </p>
        <p className="break-all text-sm">
          https://www.ipjuhae.com/check?from=friend
        </p>
        <Link className="inline-block underline" href="/service">
          서비스·가격·문의 안내
        </Link>
      </section>
    </div>
  )
}
